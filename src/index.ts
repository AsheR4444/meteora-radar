import "dotenv/config"

import { Telegraf } from "telegraf"
import { message } from "telegraf/filters"

import { isSolanaTokenAddress, processPools } from "./helpers"

const BOT_TOKEN = process.env.TOKEN!

const bot = new Telegraf(BOT_TOKEN)

bot.start((ctx) => {
  const message = [
    "🔍 Welcome to MeteoraRadar! \n",
    "I help you find the most efficient Meteora pools for any token. \n",
    "How to use: \n",
    "1. Send me a Solana token address \n",
    "2. I'll analyze all pools from app.meteora.ag and edge.meteora.ag \n",
    "3. You'll get the top 3 pools ranked by fees/liquidity ratio \n",
    "Try it now by sending a token address! 🚀 \n",
  ].join("\n")

  return ctx.reply(message)
})

bot.hears("/info", (ctx) => ctx.reply("Made by @degencoding"))

bot.on(message("text"), async (ctx) => {
  const text = ctx.message.text

  if (!isSolanaTokenAddress(text)) return

  const tokenAddress = text.match(/[1-9A-HJ-NP-Za-km-z]{44}/)?.[0]

  if (!tokenAddress) return

  processPools(ctx, tokenAddress)
})

bot.hears("/info", (ctx) => ctx.reply("Made by @degencoding"))

bot.launch()

process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))
