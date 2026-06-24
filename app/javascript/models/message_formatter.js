import { onNextEventLoopTick } from "helpers/timing_helpers"

const THREADING_TIME_WINDOW_MILLISECONDS = 5 * 60 * 1000 // 5 minutes

export const ThreadStyle = {
  none: 0,
  thread: 1,
}

export default class MessageFormatter {
  #userId
  #classes
  #dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "short" })

  constructor(userId, classes) {
    this.#userId = userId
    this.#classes = classes
  }

  format(message, threadstyle) {
    this.#setMeClass(message)
    this.#highlightMentions(message)

    if (threadstyle != ThreadStyle.none) {
      this.#threadMessage(message)
      this.#setFirstOfDayClass(message)
    }

    this.#makeVisible(message)
  }

  formatBody(body) {
    this.#formatStructuredText(body)
    this.#highlightCode(body)
  }

  #setMeClass(message) {
    const isMe = message.dataset.userId == this.#userId
    message.classList.toggle(this.#classes.me, isMe)
  }

  #makeVisible(message) {
    message.classList.add(this.#classes.formatted)
  }

  #setFirstOfDayClass(message) {
    let showSeparator = true

    if (message.dataset.messageTimestamp && message.previousElementSibling?.dataset?.messageTimestamp) {
      const prev = new Date(Number(message.previousElementSibling.dataset.messageTimestamp))
      const curr = new Date(Number(message.dataset.messageTimestamp))

      showSeparator = this.#dateFormatter.format(prev) !== this.#dateFormatter.format(curr)
    }

    message.classList.toggle(this.#classes.firstOfDay, showSeparator)
  }

  #threadMessage(message) {
    if (message.previousElementSibling) {
      const isSameUser = message.previousElementSibling.dataset.userId == message.dataset.userId
      const previousMessageIsRecent = this.#previousMessageIsRecent(message)

      message.classList.toggle(this.#classes.threaded, isSameUser && previousMessageIsRecent)
    }
  }

  #highlightMentions(message) {
    const mentionsCurrentUser = message.querySelector(this.#selectorForCurrentUser) !== null
    message.classList.toggle(this.#classes.mentioned, mentionsCurrentUser)
  }

  #highlightCode(body) {
    body.querySelectorAll("pre").forEach(block => {
      onNextEventLoopTick(() => this.#highlightCodeBlock(block))
    })
  }

  #highlightCodeBlock(block) {
    if (this.#isPlainText(block)) {
      this.#formatCodeBlock(block)
      window.hljs.highlightElement(block)
    }
  }

  #formatStructuredText(body) {
    if (!this.#hasOnlyPlainText(body)) return

    const formatted = this.#formatStructuredValue(body.innerText)
    if (!formatted) return

    const container = document.createElement("div")
    container.classList.add("trix-content")
    const block = this.#structuredTextBlock(formatted)

    container.append(block)
    body.replaceChildren(container)
  }

  #formatCodeBlock(block) {
    const formatted = this.#formatStructuredValue(block.textContent)
    if (!formatted) return

    block.textContent = formatted.text
    this.#markStructuredTextBlock(block, formatted.language)
  }

  #formatStructuredValue(text) {
    const trimmedText = text.trim()

    if (trimmedText.length == 0) return

    return this.#formatJson(trimmedText) || this.#formatXml(trimmedText)
  }

  #formatJson(text) {
    if (!text.match(/^[\[{]/)) return

    try {
      return { language: "json", text: JSON.stringify(JSON.parse(text), null, 2) }
    } catch {
      return
    }
  }

  #formatXml(text) {
    if (!text.match(/^<[\s\S]+>$/)) return

    const document = new DOMParser().parseFromString(text, "application/xml")
    if (document.querySelector("parsererror")) return

    const serializedXml = new XMLSerializer().serializeToString(document.documentElement)
    return { language: "xml", text: this.#indentXml(serializedXml) }
  }

  #indentXml(xml) {
    let indentation = 0

    return xml
      .replace(/(>)(<)(\/*)/g, "$1\n$2$3")
      .split("\n")
      .map(line => {
        if (line.match(/^<\//)) indentation = Math.max(indentation - 1, 0)

        const formattedLine = `${"  ".repeat(indentation)}${line}`

        if (line.match(/^<[^!?/][^>]*[^/]>/) && !line.match(/^<[^>]+>[^<]*<\/[^>]+>$/)) {
          indentation += 1
        }

        return formattedLine
      })
      .join("\n")
  }

  #structuredTextBlock(formatted) {
    const block = document.createElement("pre")

    block.textContent = formatted.text
    this.#markStructuredTextBlock(block, formatted.language)

    return block
  }

  #markStructuredTextBlock(block, language) {
    block.classList.add("message__structured-text", `language-${language}`)
    block.dataset.language = language
  }

  #hasOnlyPlainText(element) {
    const textContainer = element.querySelector(".trix-content") || element
    const hasRichElements = textContainer.querySelector("a, action-text-attachment, blockquote, code, figure, img, ol, pre, table, ul")

    return hasRichElements == null && textContainer.innerText.trim().length > 0
  }

  #isPlainText(element) {
    return Array.from(element.childNodes).every(node => node.nodeType === Node.TEXT_NODE)
  }

  #previousMessageIsRecent(message) {
    const previousTimestamp = message.previousElementSibling.dataset.messageTimestamp
    const threadTimestamp = message.dataset.messageTimestamp
    return Math.abs(previousTimestamp - threadTimestamp) <= THREADING_TIME_WINDOW_MILLISECONDS
  }

  get #selectorForCurrentUser() {
    return `.mention img[src^="/users/${Current.user.id}/avatar"]`
  }
}
