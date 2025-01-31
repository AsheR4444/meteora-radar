import axios from "axios"
import { Context } from "telegraf"
import { Message, Update } from "telegraf/typings/core/types/typegram"

import { MeteoraResponse } from "./types"
import Big from "big.js"

const METEORA_URL_PATTERNS = {
  app: {
    api: "https://app.meteora.ag/clmm-api/pair/",
    domain: "app.meteora.ag",
  },
  edge: {
    api: "https://edge.meteora.ag/clmm-api/pair/",
    domain: "edge.meteora.ag",
  },
} as const

type MeteoraSource = keyof typeof METEORA_URL_PATTERNS

const isSolanaTokenAddress = (text: string): boolean => {
  // Solana addresses are 44 characters long and Base58 encoded
  const solanaAddressRegex = /[1-9A-HJ-NP-Za-km-z]{44}/
  return solanaAddressRegex.test(text)
}

type MessageContext = Context<Update> & {
  message: Message.TextMessage
}

const processPools = async (ctx: MessageContext, tokenAddress: string) => {
  const meteoraUrl = `all_by_groups?page=0&limit=100&unknown=true&search_term=${tokenAddress}&sort_key=volume&order_by=desc`

  try {
    const respMain = await axios.get<MeteoraResponse>(METEORA_URL_PATTERNS.app.api + meteoraUrl)
    const respEdge = await axios.get<MeteoraResponse>(METEORA_URL_PATTERNS.edge.api + meteoraUrl)
    const pairsWithSolMain = respMain.data.groups.filter((group) => group.name.includes("SOL"))
    const pairsWithSolEdge = respEdge.data.groups.filter((group) => group.name.includes("SOL"))

    const allPairs = [...pairsWithSolMain, ...pairsWithSolEdge]

    // Get all pairs from SOL groups and calculate their coefficients
    const pairsWithCoefficients = allPairs
      .flatMap((group) => group.pairs)
      .filter((pair) => Number(pair.liquidity) > 0 && pair.fees_24h > 0)
      .map((pair) => {
        const liquidity = new Big(pair.liquidity)
        const fees = new Big(pair.fees_24h)
        // Determine if the pair is from edge or app based on which group it was found in
        const source: MeteoraSource = pairsWithSolEdge.some((group) =>
          group.pairs.some((p) => p.address === pair.address),
        )
          ? "edge"
          : "app"

        return {
          pair,
          coefficient: fees.div(liquidity).toNumber(),
          source,
        }
      })
      .filter((item) => !isNaN(item.coefficient) && isFinite(item.coefficient))
      .sort((a, b) => b.coefficient - a.coefficient)
      .slice(0, 3)

    if (pairsWithCoefficients.length === 0) {
      return
    }

    const message = pairsWithCoefficients
      .map((item, index) => {
        const domain = METEORA_URL_PATTERNS[item.source].domain
        return (
          `${index + 1}. ${item.pair.name}\n` +
          `💧 Liquidity: ${item.pair.liquidity}\n` +
          `💰 24h Fees: ${item.pair.fees_24h}\n` +
          `📊 Coefficient: ${item.coefficient.toFixed(2)}\n` +
          `🔗 Address: ${`<a href="https://${domain}/dlmm/${item.pair.address}">${domain}/dlmm/...${item.pair.address.slice(0, 8)}</a>`}\n`
        )
      })
      .join("\n")

    return ctx.reply(`Top 3 pools by fees/liquidity ratio:\n\n${message}`, {
      parse_mode: "HTML",
      // @ts-ignore
      disable_web_page_preview: true,
      // @ts-ignore
      reply_to_message_id: ctx.message.message_id,
    })
  } catch (error) {
    console.log(error)
    return
  }
}

export { METEORA_URL_PATTERNS, isSolanaTokenAddress, processPools }
