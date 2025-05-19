require("dotenv").config();

const { Bot, InputFile, InlineKeyboard } = require("grammy");
const { hydrateFiles } = require("@grammyjs/files");
const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");
const { session } = require("grammy");
const puppeteer = require("puppeteer");

const bot = new Bot(process.env.BOT_TOKEN);

const stickersDir = path.join(__dirname, "stickers");
if (!fs.existsSync(stickersDir)) {
  fs.mkdirSync(stickersDir, { recursive: true });
}

bot.api.config.use(hydrateFiles(bot.token));
bot.use(session({ initial: () => ({ userPacks: [] }) }));

(async () => {
  await bot.api.setMyCommands([
    { command: "start", description: "Iniciar o bot" },
    {
      command: "stickerly",
      description: "Importar pack do Sticker.ly para o Telegram",
    },
    {
      command: "addsticker",
      description: "Adicionar sticker a um pack existente",
    },
    { command: "setpackicon", description: "Definir ícone do pack" },
    { command: "renamepack", description: "Renomear pack de stickers" },
    { command: "deletepack", description: "Deletar pack de stickers" },
    { command: "cancel", description: "Cancelar a ação atual" },
  ]);
})();

bot.command("start", (ctx) =>
  ctx.reply(
    "👋 Envie uma imagem ou um link de pack do Sticker.ly para importar para o Telegram!\n\n" +
      "📋 Comandos disponíveis:\n" +
      "/stickerly - Importar pack do Sticker.ly\n" +
      "/addsticker - Adicionar sticker a pack existente\n" +
      "/setpackicon - Definir ícone do pack\n" +
      "/renamepack - Renomear pack\n" +
      "/deletepack - Deletar pack\n" +
      "/cancel - Cancelar ação atual"
  )
);

bot.command("cancel", async (ctx) => {
  if (
    !ctx.session.awaitingEmojis &&
    !ctx.session.stickerlyLink &&
    !ctx.session.awaitingPackName &&
    !ctx.session.awaitingSticker &&
    !ctx.session.awaitingNewPackName &&
    !ctx.session.awaitingPackIcon &&
    !ctx.session.awaitingTitle &&
    !ctx.session.awaitingDeleteConfirmation &&
    !ctx.session.awaitingPackSelection
  ) {
    await ctx.reply(
      "Não há nenhum comando ativo para cancelar, eu não estava fazendo nada de qualquer forma... 😴"
    );
    return;
  }

  // Limpar todas as sessões
  ctx.session.awaitingEmojis = false;
  ctx.session.stickerlyLink = undefined;
  ctx.session.awaitingPackName = false;
  ctx.session.awaitingSticker = false;
  ctx.session.awaitingNewPackName = false;
  ctx.session.awaitingPackIcon = false;
  ctx.session.awaitingTitle = false;
  ctx.session.awaitingDeleteConfirmation = false;
  ctx.session.awaitingPackSelection = undefined;
  ctx.session.packTitle = undefined;
  ctx.session.selectedPackName = undefined;

  await ctx.reply(
    "❌ Ação cancelada. Você pode enviar um novo comando a qualquer momento."
  );
});

bot.command("stickerly", async (ctx) => {
  await ctx.reply(
    "🔗 Envie um link de pack do Sticker.ly para importar os stickers para o Telegram!"
  );
});

bot.command("addsticker", async (ctx) => {
  if (!ctx.session.userPacks || ctx.session.userPacks.length === 0) {
    ctx.session.awaitingPackName = "addsticker";
    await ctx.reply(
      "📦 Você ainda não tem packs registrados neste bot.\n" +
        "Envie o nome técnico do pack (ex: meupack_123456_by_botname) ou crie um novo pack primeiro."
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  ctx.session.userPacks.forEach((pack, index) => {
    keyboard.text(pack.title, `addsticker_${index}`).row();
  });
  keyboard.text("📝 Digitar nome manualmente", "addsticker_manual");

  ctx.session.awaitingPackSelection = "addsticker";

  await ctx.reply("📦 Selecione o pack onde quer adicionar o sticker:", {
    reply_markup: keyboard,
  });
});

bot.command("setpackicon", async (ctx) => {
  if (!ctx.session.userPacks || ctx.session.userPacks.length === 0) {
    ctx.session.awaitingPackName = "setpackicon";
    await ctx.reply(
      "🎨 Você ainda não tem packs registrados neste bot.\n" +
        "Envie o nome técnico do pack (ex: meupack_123456_by_botname) ou crie um novo pack primeiro."
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  ctx.session.userPacks.forEach((pack, index) => {
    keyboard.text(pack.title, `setpackicon_${index}`).row();
  });
  keyboard.text("📝 Digitar nome manualmente", "setpackicon_manual");

  ctx.session.awaitingPackSelection = "setpackicon";

  await ctx.reply("🎨 Selecione o pack para definir o ícone:", {
    reply_markup: keyboard,
  });
});

bot.command("renamepack", async (ctx) => {
  if (!ctx.session.userPacks || ctx.session.userPacks.length === 0) {
    ctx.session.awaitingPackName = "renamepack";
    await ctx.reply(
      "✏️ Você ainda não tem packs registrados neste bot.\n" +
        "Envie o nome técnico do pack (ex: meupack_123456_by_botname) ou crie um novo pack primeiro."
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  ctx.session.userPacks.forEach((pack, index) => {
    keyboard.text(pack.title, `renamepack_${index}`).row();
  });
  keyboard.text("📝 Digitar nome manualmente", "renamepack_manual");

  ctx.session.awaitingPackSelection = "renamepack";

  await ctx.reply("✏️ Selecione o pack que quer renomear:", {
    reply_markup: keyboard,
  });
});

bot.command("deletepack", async (ctx) => {
  if (!ctx.session.userPacks || ctx.session.userPacks.length === 0) {
    ctx.session.awaitingPackName = "deletepack";
    await ctx.reply(
      "🗑️ Você ainda não tem packs registrados neste bot.\n" +
        "Envie o nome técnico do pack (ex: meupack_123456_by_botname) ou crie um novo pack primeiro."
    );
    return;
  }

  const keyboard = new InlineKeyboard();
  ctx.session.userPacks.forEach((pack, index) => {
    keyboard.text(pack.title, `deletepack_${index}`).row();
  });
  keyboard.text("📝 Digitar nome manualmente", "deletepack_manual");

  ctx.session.awaitingPackSelection = "deletepack";

  await ctx.reply(
    "🗑️ Selecione o pack que quer deletar:\n" +
      "⚠️ ATENÇÃO: Esta ação é irreversível!",
    { reply_markup: keyboard }
  );
});

bot.on(":sticker", async (ctx) => {
  // Se estiver aguardando ícone de pack
  if (ctx.session.awaitingPackIcon && ctx.session.selectedPackName) {
    try {
      const file = await ctx.getFile();
      const url = file.getUrl();
      const buffer = await axios.get(url, { responseType: "arraybuffer" });

      const filename = path.join(
        __dirname,
        "stickers",
        `${ctx.from.id}-icon-${Date.now()}.png`
      );

      await sharp(buffer.data)
        .resize(100, 100, { fit: "contain" })
        .png()
        .toFile(filename);

      await ctx.api.setStickerSetThumbnail(
        ctx.from.id,
        ctx.session.selectedPackName,
        new InputFile(filename)
      );

      fs.unlinkSync(filename);
      ctx.session.awaitingPackIcon = false;
      ctx.session.selectedPackName = undefined;

      await ctx.reply("✅ Ícone do pack definido com sucesso!");
    } catch (err) {
      console.error(err);
      await ctx.reply(
        "🚨 Erro ao definir ícone do pack. Verifique se você é o dono do pack."
      );
    }
    return;
  }

  // Se estiver aguardando sticker para adicionar ao pack
  if (ctx.session.awaitingSticker && ctx.session.selectedPackName) {
    try {
      const file = await ctx.getFile();
      const url = file.getUrl();
      const buffer = await axios.get(url, { responseType: "arraybuffer" });

      const filename = path.join(
        __dirname,
        "stickers",
        `${ctx.from.id}-add-${Date.now()}.png`
      );

      await sharp(buffer.data)
        .resize(512, 512, { fit: "contain" })
        .png()
        .toFile(filename);

      await ctx.api.addStickerToSet(ctx.from.id, ctx.session.selectedPackName, {
        sticker: new InputFile(filename),
        emoji_list: ["😀"], // Emoji padrão
        format: "static",
      });

      fs.unlinkSync(filename);
      ctx.session.awaitingSticker = false;
      ctx.session.selectedPackName = undefined;

      await ctx.reply("✅ Sticker adicionado ao pack com sucesso!");
    } catch (err) {
      console.error(err);
      let errorMsg = "🚨 Erro ao adicionar sticker ao pack.";
      if (
        err.description &&
        err.description.includes("STICKER_SET_NOT_EXISTS")
      ) {
        errorMsg += " O pack não existe.";
      } else if (
        err.description &&
        err.description.includes("USER_NOT_PARTICIPANT")
      ) {
        errorMsg += " Você não é o dono deste pack.";
      }
      await ctx.reply(errorMsg);
    }
    return;
  }

  ctx.reply(
    "⚙️ Ainda não suportamos stickers como entrada para criação. Envie uma imagem!"
  );
});

bot.on(":document", async (ctx) => {
  const mime = ctx.message.document.mime_type;
  if (!["image/png", "image/jpeg", "image/webp"].includes(mime)) {
    return ctx.reply(
      "⚠️ Só aceito imagens em PNG, JPEG ou WEBP como documentos."
    );
  }

  // Se estiver aguardando ícone de pack
  if (ctx.session.awaitingPackIcon && ctx.session.selectedPackName) {
    try {
      const file = await ctx.getFile();
      const url = file.getUrl();
      const buffer = await axios.get(url, { responseType: "arraybuffer" });

      const filename = path.join(
        __dirname,
        "stickers",
        `${ctx.from.id}-icon-${Date.now()}.png`
      );

      await sharp(buffer.data)
        .resize(100, 100, { fit: "contain" })
        .png()
        .toFile(filename);

      await ctx.api.setStickerSetThumbnail(
        ctx.from.id,
        ctx.session.selectedPackName,
        new InputFile(filename)
      );

      fs.unlinkSync(filename);
      ctx.session.awaitingPackIcon = false;
      ctx.session.selectedPackName = undefined;

      await ctx.reply("✅ Ícone do pack definido com sucesso!");
    } catch (err) {
      console.error(err);
      await ctx.reply(
        "🚨 Erro ao definir ícone do pack. Verifique se você é o dono do pack."
      );
    }
    return;
  }

  // Se estiver aguardando sticker para adicionar ao pack
  if (ctx.session.awaitingSticker && ctx.session.selectedPackName) {
    try {
      const file = await ctx.getFile();
      const url = file.getUrl();
      const buffer = await axios.get(url, { responseType: "arraybuffer" });

      const filename = path.join(
        __dirname,
        "stickers",
        `${ctx.from.id}-add-${Date.now()}.png`
      );

      await sharp(buffer.data)
        .resize(512, 512, { fit: "contain" })
        .png()
        .toFile(filename);

      await ctx.api.addStickerToSet(ctx.from.id, ctx.session.selectedPackName, {
        sticker: new InputFile(filename),
        emoji_list: ["😀"], // Emoji padrão
        format: "static",
      });

      fs.unlinkSync(filename);
      ctx.session.awaitingSticker = false;
      ctx.session.selectedPackName = undefined;

      await ctx.reply("✅ Sticker adicionado ao pack com sucesso!");
    } catch (err) {
      console.error(err);
      let errorMsg = "🚨 Erro ao adicionar sticker ao pack.";
      if (
        err.description &&
        err.description.includes("STICKER_SET_NOT_EXISTS")
      ) {
        errorMsg += " O pack não existe.";
      } else if (
        err.description &&
        err.description.includes("USER_NOT_PARTICIPANT")
      ) {
        errorMsg += " Você não é o dono deste pack.";
      }
      await ctx.reply(errorMsg);
    }
    return;
  }

  // Funcionalidade original de conversão de imagem para sticker
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

bot.on(":photo", async (ctx) => {
  // Se estiver aguardando ícone de pack
  if (ctx.session.awaitingPackIcon && ctx.session.selectedPackName) {
    try {
      const file = await ctx.getFile();
      const url = file.getUrl();
      const buffer = await axios.get(url, { responseType: "arraybuffer" });

      const filename = path.join(
        __dirname,
        "stickers",
        `${ctx.from.id}-icon-${Date.now()}.png`
      );

      await sharp(buffer.data)
        .resize(100, 100, { fit: "contain" })
        .png()
        .toFile(filename);

      await ctx.api.setStickerSetThumbnail(
        ctx.from.id,
        ctx.session.selectedPackName,
        new InputFile(filename)
      );

      fs.unlinkSync(filename);
      ctx.session.awaitingPackIcon = false;
      ctx.session.selectedPackName = undefined;

      await ctx.reply("✅ Ícone do pack definido com sucesso!");
    } catch (err) {
      console.error(err);
      await ctx.reply(
        "🚨 Erro ao definir ícone do pack. Verifique se você é o dono do pack."
      );
    }
    return;
  }

  // Se estiver aguardando sticker para adicionar ao pack
  if (ctx.session.awaitingSticker && ctx.session.selectedPackName) {
    try {
      const file = await ctx.getFile();
      const url = file.getUrl();
      const buffer = await axios.get(url, { responseType: "arraybuffer" });

      const filename = path.join(
        __dirname,
        "stickers",
        `${ctx.from.id}-add-${Date.now()}.png`
      );

      await sharp(buffer.data)
        .resize(512, 512, { fit: "contain" })
        .png()
        .toFile(filename);

      await ctx.api.addStickerToSet(ctx.from.id, ctx.session.selectedPackName, {
        sticker: new InputFile(filename),
        emoji_list: ["😀"], // Emoji padrão
        format: "static",
      });

      fs.unlinkSync(filename);
      ctx.session.awaitingSticker = false;
      ctx.session.selectedPackName = undefined;

      await ctx.reply("✅ Sticker adicionado ao pack com sucesso!");
    } catch (err) {
      console.error(err);
      let errorMsg = "🚨 Erro ao adicionar sticker ao pack.";
      if (
        err.description &&
        err.description.includes("STICKER_SET_NOT_EXISTS")
      ) {
        errorMsg += " O pack não existe.";
      } else if (
        err.description &&
        err.description.includes("USER_NOT_PARTICIPANT")
      ) {
        errorMsg += " Você não é o dono deste pack.";
      }
      await ctx.reply(errorMsg);
    }
    return;
  }

  // Funcionalidade original de conversão de foto para sticker
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
    ctx.reply("🚨 Erro ao processar a foto.");
  }
});

async function getStickerlyImages(packUrl) {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(packUrl, { waitUntil: "networkidle2" });

  await page.waitForSelector("img.sticker_img");

  const images = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("img.sticker_img"))
      .map((img) => img.src)
      .filter((src) => src.endsWith(".png"));
  });

  await browser.close();
  return images;
}

bot.on("message:text", async (ctx) => {
  // Prioridade: se for link do Sticker.ly, sempre inicia o fluxo de importação
  const stickerlyRegex = /https?:\/\/(?:www\.)?sticker\.ly\/.+/i;
  if (stickerlyRegex.test(ctx.message.text)) {
    // Limpa qualquer estado anterior de sessão
    ctx.session.awaitingEmojis = false;
    ctx.session.stickerlyLink = undefined;
    ctx.session.awaitingPackName = false;
    ctx.session.awaitingSticker = false;
    ctx.session.awaitingNewPackName = false;
    ctx.session.awaitingPackIcon = false;
    ctx.session.awaitingTitle = false;
    ctx.session.packTitle = undefined;
    ctx.session.selectedPackName = undefined;

    ctx.session.awaitingTitle = true;
    ctx.session.stickerlyLink = ctx.message.text;
    await ctx.reply(
      "✏️ Qual título você quer para o pack? (máx. 64 caracteres)"
    );
    return;
  }

  // Se está aguardando emojis para o Sticker.ly
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
    const emojisArr = images.map((_, i) => emojiList[i] || "😀");

    console.log("Criando pack com:", {
      userId,
      setName,
      packTitle,
      sticker: stickerFiles[0],
      emoji: emojisArr[0],
    });

    try {
      await ctx.api.createNewStickerSet(userId, setName, packTitle, [
        {
          sticker: new InputFile(stickerFiles[0]),
          emoji_list: [emojisArr[0]],
          format: "static",
        },
      ]);

      // Salvar pack na sessão do usuário
      if (!ctx.session.userPacks) ctx.session.userPacks = [];
      ctx.session.userPacks.push({
        name: setName,
        title: packTitle,
        createdAt: new Date().toLocaleDateString("pt-BR"),
      });
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

  // Se está aguardando título do pack para Sticker.ly
  if (ctx.session.awaitingTitle && ctx.session.stickerlyLink) {
    ctx.session.packTitle = ctx.message.text.trim().slice(0, 64);
    ctx.session.awaitingTitle = false;
    ctx.session.awaitingEmojis = true;
    await ctx.reply(
      "📝 Agora envie uma lista de emojis (um para cada sticker, na ordem). Se faltar, será usado 😀."
    );
    return;
  }

  // Se está aguardando novo nome para pack
  if (ctx.session.awaitingNewPackName && ctx.session.selectedPackName) {
    const newTitle = ctx.message.text.trim().slice(0, 64);
    if (!newTitle) {
      await ctx.reply("❌ O título não pode estar vazio. Tente novamente:");
      return;
    }
    try {
      await ctx.api.setStickerSetTitle(ctx.session.selectedPackName, newTitle);

      // Atualizar título na sessão
      if (ctx.session.userPacks) {
        const packIndex = ctx.session.userPacks.findIndex(
          (p) => p.name === ctx.session.selectedPackName
        );
        if (packIndex !== -1) {
          ctx.session.userPacks[packIndex].title = newTitle;
        }
      }

      ctx.session.awaitingNewPackName = false;
      const packName = ctx.session.selectedPackName;
      ctx.session.selectedPackName = undefined;

      await ctx.reply(
        `✅ Pack renomeado com sucesso!\n` +
          `📝 Novo título: "${newTitle}"\n` +
          `🔗 Link: https://t.me/addstickers/${packName}`
      );
    } catch (err) {
      console.error(err);
      let errorMsg = "🚨 Erro ao renomear pack.";
      if (
        err.description &&
        err.description.includes("STICKER_SET_NOT_EXISTS")
      ) {
        errorMsg += " O pack não existe.";
      } else if (
        err.description &&
        err.description.includes("USER_NOT_PARTICIPANT")
      ) {
        errorMsg += " Você não é o dono deste pack.";
      }
      await ctx.reply(errorMsg);
    }
    return;
  }

  // Se está aguardando nome do pack para operações
  if (ctx.session.awaitingPackName) {
    const packName = ctx.message.text.trim();
    const operation = ctx.session.awaitingPackName;
    ctx.session.awaitingPackName = false;
    ctx.session.selectedPackName = packName;

    if (operation === "addsticker") {
      ctx.session.awaitingSticker = true;
      await ctx.reply(
        `📎 Agora envie a imagem que você quer adicionar ao pack "${packName}"`
      );
    } else if (operation === "setpackicon") {
      ctx.session.awaitingPackIcon = true;
      await ctx.reply(
        `🎨 Agora envie a imagem que será o ícone do pack "${packName}"`
      );
    } else if (operation === "renamepack") {
      ctx.session.awaitingNewPackName = true;
      await ctx.reply(
        `✏️ Agora digite o novo título para o pack "${packName}".\n` +
          `💡 Você pode usar qualquer nome que quiser (máx. 64 caracteres)!\n` +
          `Exemplos: "Meus Emojis", "Pack Divertido", "Stickers do Trabalho", etc.`
      );
    } else if (operation === "deletepack") {
      try {
        await ctx.api.deleteStickerSet(packName);

        // Remover pack da sessão
        if (ctx.session.userPacks) {
          ctx.session.userPacks = ctx.session.userPacks.filter(
            (p) => p.name !== packName
          );
        }

        ctx.session.selectedPackName = undefined;
        await ctx.reply(`✅ Pack "${packName}" deletado com sucesso!`);
      } catch (err) {
        console.error(err);
        let errorMsg = "🚨 Erro ao deletar pack.";
        if (
          err.description &&
          err.description.includes("STICKER_SET_NOT_EXISTS")
        ) {
          errorMsg += " O pack não existe.";
        } else if (
          err.description &&
          err.description.includes("USER_NOT_PARTICIPANT")
        ) {
          errorMsg += " Você não é o dono deste pack.";
        }
        await ctx.reply(errorMsg);
      }
    }
    return;
  }

  // Caso não seja nenhuma operação específica
  await ctx.reply(
    "🤔 Não entendi. Use um dos comandos disponíveis:\n" +
      "/stickerly - Importar do Sticker.ly\n" +
      "/addsticker - Adicionar sticker a pack\n" +
      "/setpackicon - Definir ícone do pack\n" +
      "/renamepack - Renomear pack\n" +
      "/deletepack - Deletar pack\n" +
      "/cancel - Cancelar ação atual\n" +
      "\nOu envie uma imagem para converter em sticker!"
  );
});

// Handlers para inline keyboards
bot.callbackQuery(
  /^(addsticker|setpackicon|renamepack|deletepack)_(\d+)$/,
  async (ctx) => {
    const [, operation, index] = ctx.match;
    const packIndex = parseInt(index);

    if (!ctx.session.userPacks || !ctx.session.userPacks[packIndex]) {
      await ctx.answerCallbackQuery("❌ Pack não encontrado!");
      return;
    }

    const pack = ctx.session.userPacks[packIndex];
    ctx.session.selectedPackName = pack.name;
    ctx.session.awaitingPackSelection = undefined;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(`✅ Pack selecionado: **${pack.title}**`, {
      parse_mode: "Markdown",
    });

    if (operation === "addsticker") {
      ctx.session.awaitingSticker = true;
      await ctx.reply(
        `📎 Agora envie a imagem que você quer adicionar ao pack "${pack.title}"`
      );
    } else if (operation === "setpackicon") {
      ctx.session.awaitingPackIcon = true;
      await ctx.reply(
        `🎨 Agora envie a imagem que será o ícone do pack "${pack.title}"`
      );
    } else if (operation === "renamepack") {
      ctx.session.awaitingNewPackName = true;
      await ctx.reply(
        `✏️ Digite o novo título para o pack "${pack.title}".\n` +
          `💡 Você pode usar qualquer nome que quiser (máx. 64 caracteres)!\n` +
          `Exemplos: "Meus Emojis", "Pack Divertido", "Stickers do Trabalho", etc.`
      );
    } else if (operation === "deletepack") {
      const confirmKeyboard = new InlineKeyboard()
        .text("✅ Sim, deletar", `confirm_delete_${packIndex}`)
        .text("❌ Cancelar", "cancel_delete");

      ctx.session.awaitingDeleteConfirmation = true;

      await ctx.reply(
        `🗑️ Tem certeza que quer deletar o pack "${pack.title}"?\n` +
          `⚠️ Esta ação é irreversível!`,
        { reply_markup: confirmKeyboard }
      );
    }
  }
);

bot.callbackQuery(
  /^(addsticker|setpackicon|renamepack|deletepack)_manual$/,
  async (ctx) => {
    const [, operation] = ctx.match;
    ctx.session.awaitingPackName = operation;
    ctx.session.awaitingPackSelection = undefined;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `📝 Envie o nome técnico do pack (ex: meupack_123456_by_botname)`
    );
  }
);

bot.callbackQuery(/^confirm_delete_(\d+)$/, async (ctx) => {
  const [, index] = ctx.match;
  const packIndex = parseInt(index);

  if (!ctx.session.userPacks || !ctx.session.userPacks[packIndex]) {
    await ctx.answerCallbackQuery("❌ Pack não encontrado!");
    return;
  }

  const pack = ctx.session.userPacks[packIndex];

  try {
    await ctx.api.deleteStickerSet(pack.name);

    // Remover pack da sessão
    ctx.session.userPacks.splice(packIndex, 1);

    ctx.session.awaitingDeleteConfirmation = false;

    await ctx.answerCallbackQuery("✅ Pack deletado!");
    await ctx.editMessageText(`✅ Pack "${pack.title}" deletado com sucesso!`);
  } catch (err) {
    ctx.session.awaitingDeleteConfirmation = false;
    console.error(err);
    let errorMsg = "🚨 Erro ao deletar pack.";
    if (err.description && err.description.includes("STICKER_SET_NOT_EXISTS")) {
      errorMsg += " O pack não existe.";
    } else if (
      err.description &&
      err.description.includes("USER_NOT_PARTICIPANT")
    ) {
      errorMsg += " Você não é o dono deste pack.";
    }
    await ctx.answerCallbackQuery(errorMsg);
  }
});

bot.callbackQuery("cancel_delete", async (ctx) => {
  ctx.session.awaitingDeleteConfirmation = false;
  await ctx.answerCallbackQuery("❌ Cancelado");
  await ctx.editMessageText("❌ Operação cancelada.");
});

bot.start();
