# side-question

English | [日本語](../ja/mods/side-question.md)

While Claude works, you sometimes want to ask "wait, why did you design it this way?" Asking normally stops the work, and the answer enters the conversation and uses Claude's context. side-question's `/btw` asks a single question as a continuation of the conversation, separately, and shows the answer in a pane. Claude keeps working, and the answer is not added to the conversation.

## Usage

```text
/btw why does session-diff compare against HEAD?
```

- You can ask right away, even in the middle of Claude's turn
- The answer appears in a pane, which keeps the last 10 questions and answers
- Typing `/btw` alone opens a pane with an input box. Questions asked there leave nothing in the conversation. When you ask with `/btw <question>`, the command line you typed stays in the conversation, like any other slash command

## How the answer is made

It sends the question once to the same model, with the conversation so far as context. In front of the question it adds an instruction saying this is a side question separate from the current task, so the model should not continue the task and should answer only this question, briefly. Answers are kept up to 10,000 characters.

Because the start of the conversation is unchanged, most of the input is read from the prompt cache. The pane shows the share of input read from the cache under each answer.

## Cost

Each question adds one request to the model. Even with the cache, each request's input grows as the conversation gets longer.

## In the extension

With no pane, `/btw <question>` waits for the answer and puts it in the reply. The answer then stays in the conversation and in Claude's context for later turns. The terminal's keep-it-out-of-the-conversation behavior is not available there.
