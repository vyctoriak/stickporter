# StickerPorter Bot

A Telegram bot to import Sticker.ly packs and images as Telegram sticker sets, with emoji and title customization.

## Features

- **Import Sticker.ly packs:** Send a Sticker.ly pack link and the bot will create a Telegram sticker set for you.
- **Custom emojis:** Choose which emoji to assign to each sticker.
- **Custom pack title:** Choose the name of your new Telegram sticker set.
- **Image to sticker:** Send an image (PNG, JPEG, WEBP) and get it back as a Telegram sticker.
- **Progress feedback:** The bot shows progress and error messages during the import process.
- **Cancel anytime:** Use `/cancel` to abort the current operation.

---

## Usage

1. **Start the bot:**  
   Send `/start` to see the welcome message.

2. **Import a Sticker.ly pack:**

   - Send `/stickerly` or just paste a Sticker.ly pack link (e.g. `https://sticker.ly/s/BE9H2K`).
   - The bot will ask for a title for your new sticker pack.
   - Then, send a list of emojis (one for each sticker, in order). If you send fewer emojis, the default 😀 will be used for the rest.
   - The bot will process the pack and send you the link to your new Telegram sticker set.

3. **Convert an image to sticker:**

   - Send an image as a document (PNG, JPEG, or WEBP).
   - The bot will convert and return it as a Telegram sticker.

4. **Cancel an operation:**
   - Send `/cancel` at any time to abort the current import or emoji selection.

---

## Commands

- `/start` – Show welcome/help message.
- `/stickerly` – Instructions for importing a Sticker.ly pack.
- `/cancel` – Cancel the current operation.

---

## Requirements

- Node.js 18+
- Telegram bot token (from [@BotFather](https://t.me/BotFather))

---

## Setup

1. **Clone the repository:**

   ```sh
   git clone <repo-url>
   cd zap-sticker-bot
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Configure environment variables:**

   - Create a `.env` file with:
     ```
     BOT_TOKEN=your_telegram_bot_token_here
     ```

4. **Run the bot:**
   ```sh
   node index.js
   ```

---

## How it works

- **Sticker.ly packs:**  
  The bot uses Puppeteer to scrape sticker images from Sticker.ly pack links. It downloads the PNGs, resizes them to 512x512, and uploads them as a new Telegram sticker set.
- **Telegram sticker API:**  
  Uses the latest Telegram API for sticker set creation, supporting emoji lists and static format.
- **Session:**  
  Uses grammY's session middleware to track user state between steps (title, emoji selection, etc).

---

## Troubleshooting

- **Bot says "can't parse stickers JSON object" or "invalid user_id specified":**  
  Make sure you are using the latest version of `grammy` and `@grammyjs/files`, and that you are using the correct API call format (see code).
- **Bot says "Não consegui encontrar stickers nesse pack":**  
  The Sticker.ly link may be invalid, private, or the pack is not available for scraping.
- **Bot does not respond:**  
  Make sure your bot token is correct and the bot is running.

---

## Contributing

Pull requests and suggestions are welcome!  
If you find a bug or want a new feature, open an issue or PR.

---

## License

MIT
