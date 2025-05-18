require("dotenv").config();

const { Bot, InputFile } = require("grammy");
const { hydrateFiles } = require("@grammyjs/files");
const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { session } = require("grammy");
const puppeteer = require("puppeteer");

const bot = new Bot(process.env.BOT_TOKEN);

bot.api.config.use(hydrateFiles(bot.token));
bot.use(session({ initial: () => ({}) }));

(async () => {
  await bot.api.setMyCommands([
    { command: "start", description: "Iniciar o bot" },
    { command: "cancel", description: "Cancelar a ação atual" },
  ]);
})();

bot.command("start", (ctx) =>
  ctx.reply(`👋 Envie um sticker ou imagem para importar!`)
);

bot.command("cancel", async (ctx) => {
  ctx.session.awaitingEmojis = false;
  ctx.session.stickerlyLink = undefined;
  await ctx.reply(
    "❌ Ação cancelada. Você pode enviar um novo link a qualquer momento."
  );
});

bot.on(":sticker", async (ctx) => {
  ctx.reply(
    "⚙️ Ainda não suportamos stickers como entrada. Envie uma imagem ou print do Whatsapp!"
  );
});

bot.on(":document", async (ctx) => {
  const mime = ctx.message.document.mime_type;
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
    return ctx.reply(
      "⚠️ Só aceito imagens em PNG, JPEG ou WEBP como documentos."
    );
  }

  try {
    const file = await ctx.getFile();
    const url = file.getUrl();

    const buffer = await axios.get(url, { responseType: "arraybuffer" });

    const filename = path.join(
      __dirname,
      "stickers",
      `${ctx.from.id}-${Date.now()}.webp`
    );
    await sharp(buffer.data)
      .resize(512, 512, { fit: "contain" })
      .webp()
      .toFile(filename);

    await ctx.replyWithSticker(new InputFile(filename));
    fs.unlinkSync(filename);
  } catch (err) {
    console.error(err);
    ctx.reply("🚨 Erro ao processar o documento.");
  }
});

async function getStickerlyImages(packUrl) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(packUrl, { waitUntil: "networkidle2" });

  // Aguarda os stickers aparecerem
  await page.waitForSelector("img.sticker_img");

  // Extrai as URLs das imagens dos stickers (agora .png)
  const images = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img.sticker_img"))
      .map((img) => img.src)
      .filter((src) => src.endsWith(".png"));
  });

  await browser.close();
  return images;
}

bot.on("message:text", async (ctx) => {
  // Se está aguardando emojis
  if (
    ctx.session.awaitingEmojis &&
    ctx.session.stickerlyLink &&
    ctx.session.packTitle
  ) {
    const emojiList = ctx.message.text.match(/\p{Emoji}/gu) || [];
    ctx.session.awaitingEmojis = false;
    const stickerlyLink = ctx.session.stickerlyLink;
    const packTitle = ctx.session.packTitle;
    ctx.session.stickerlyLink = undefined;
    ctx.session.packTitle = undefined;
    const processingMsg = await ctx.reply(
      `⏳ Processando o pack do Sticker.ly com seus emojis e título "${packTitle}", isso pode levar alguns segundos...`
    );
    let images = [];
    try {
      images = await getStickerlyImages(stickerlyLink);
    } catch (err) {
      console.error(err);
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "🚨 Erro ao acessar o link do Sticker.ly. Tente novamente ou envie outro link."
      );
      return;
    }
    if (images.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "⚠️ Não consegui encontrar stickers nesse pack. Talvez o link esteja incorreto ou o pack não exista mais."
      );
      return;
    }
    await ctx.api.editMessageText(
      ctx.chat.id,
      processingMsg.message_id,
      `✅ Encontrei ${images.length} stickers! Vou criar um novo pack no Telegram. Aguarde...`
    );
    // 1. Baixar e converter todas as imagens
    const stickerFiles = [];
    for (let i = 0; i < images.length; i++) {
      const imgUrl = images[i];
      try {
        const response = await axios.get(imgUrl, {
          responseType: "arraybuffer",
        });
        const filename = path.join(
          __dirname,
          "stickers",
          `${ctx.from.id}-${Date.now()}-${i}.png`
        );
        await sharp(response.data)
          .resize(512, 512, { fit: "contain" })
          .png()
          .toFile(filename);
        stickerFiles.push(filename);
      } catch (err) {
        console.error(`Erro ao baixar/converter sticker ${i + 1}:`, err);
        await ctx.reply(
          `🚨 Erro ao baixar ou converter o sticker ${
            i + 1
          }. Pulando para o próximo.`
        );
      }
    }
    if (stickerFiles.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        processingMsg.message_id,
        "🚨 Não foi possível converter nenhum sticker. Tente novamente ou envie outro link."
      );
      return;
    }
    // 2. Criar novo pack
    const userId = ctx.from.id;
    const username = ctx.from.username || `user${userId}`;
    const timestamp = Date.now();
    const setName =
      `stickerly_${userId}_${timestamp}_by_${bot.me.username}`.toLowerCase();
    // Usa emoji do usuário ou fallback para 😀
    const emojisArr = images.map((_, i) => emojiList[i] || "😀");

    // Log para debug
    console.log("Criando pack com:", {
      userId,
      setName,
      packTitle,
      sticker: stickerFiles[0],
      emoji: emojisArr[0],
    });

    try {
      // Nova API - passa stickers como array de objetos JSON
      await ctx.api.createNewStickerSet(userId, setName, packTitle, [
        {
          sticker: new InputFile(stickerFiles[0]),
          emoji_list: [emojisArr[0]],
          format: "static",
        },
      ]);
    } catch (err) {
      console.error("Erro ao criar o pack:", err);
      stickerFiles.forEach((f) => fs.unlinkSync(f));
      let msg = "🚨 Erro ao criar o pack de stickers.";
      if (
        err.description &&
        err.description.includes("name is already occupied")
      ) {
        msg += " O nome do pack já existe. Tente novamente.";
      } else if (
        err.description &&
        err.description.includes("USER_ID_INVALID")
      ) {
        msg += " O bot precisa ser iniciado pelo usuário no Telegram.";
      }
      await ctx.api.editMessageText(ctx.chat.id, processingMsg.message_id, msg);
      return;
    }

    // 3. Adicionar os demais stickers
    for (let i = 1; i < stickerFiles.length; i++) {
      try {
        await bot.api.addStickerToSet(userId, setName, {
          sticker: new InputFile(stickerFiles[i]),
          emoji_list: [emojisArr[i]],
          format: "static",
        });
        const progresso = Math.round(((i + 1) / stickerFiles.length) * 10);
        const barra = "🟩".repeat(progresso) + "⬜".repeat(10 - progresso);
        await ctx.api.editMessageText(
          ctx.chat.id,
          processingMsg.message_id,
          `🧩 Progresso: ${barra} (${i + 1}/${stickerFiles.length})`
        );
      } catch (err) {
        console.error(`Erro ao adicionar sticker ${i + 1}:`, err);
        await ctx.reply(
          `🚨 Erro ao adicionar o sticker ${
            i + 1
          } ao pack. Pulando para o próximo.`
        );
      }
    }
    stickerFiles.forEach((f) => fs.unlinkSync(f));
    // 4. Enviar link do pack
    const packUrl = `https://t.me/addstickers/${setName}`;
    await ctx.api.editMessageText(
      ctx.chat.id,
      processingMsg.message_id,
      `✅ Pack criado! Veja e adicione aqui: ${packUrl}`
    );
    return;
  }
  // Se está aguardando título do pack
  if (ctx.session.awaitingTitle && ctx.session.stickerlyLink) {
    ctx.session.packTitle = ctx.message.text.trim().slice(0, 64);
    ctx.session.awaitingTitle = false;
    ctx.session.awaitingEmojis = true;
    await ctx.reply(
      "📝 Agora envie uma lista de emojis (um para cada sticker, na ordem). Se faltar, será usado 😀."
    );
    return;
  }
  // Se recebeu link do Sticker.ly, pede título
  const stickerlyRegex = /https?:\/\/(?:www\.)?sticker\.ly\/.+/i;
  if (stickerlyRegex.test(ctx.message.text)) {
    ctx.session.awaitingTitle = true;
    ctx.session.stickerlyLink = ctx.message.text;
    await ctx.reply(
      "✏️ Qual título você quer para o pack? (máx. 64 caracteres)"
    );
    return;
  }
});

bot.start();
