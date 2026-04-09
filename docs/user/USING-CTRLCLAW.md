# Using CtrlClaw

## Login

Open CtrlClaw in the browser and sign in using the configured authentication flow.

### Security reminder

**Default credentials**, when present in local setup examples, are for controlled development use only:

- Change the password immediately after the first login
- Never keep default credentials in staging, shared, or public environments
- Use strong authentication for any exposed deployment

**Note:** The system does not currently enforce password change on first login. You must change default credentials manually.

## Creating a conversation

Once inside the app, start a new conversation from the chat interface. Each conversation is tied to an agent.

## Choosing an agent

Select the agent you want to work with. Conversations should stay isolated by agent, so context does not leak between them.

## Sending a message

Type your message and send it through the chat interface. CtrlClaw will use the configured backend and WebSocket layer to process the request and return the response.

## Using context

CtrlClaw can include context in the message flow. Context should be visible, limited, and controlled by the user.

Use context when:
- You want continuity in a conversation
- You want the agent to work with recent operational memory
- You need better follow-up answers

## Reconnect behavior

If the WebSocket connection drops, CtrlClaw should try to reconnect. In controlled failures, the interface should make the state visible instead of hiding it.

## Common states you may see

### Connected
The app is connected and ready for real-time updates.

### Reconnecting
The app temporarily lost the WebSocket connection and is trying to restore it.

### Rate limited
Too many requests or connections were attempted in a short period.

### Temporarily unavailable
A protection layer, such as a circuit breaker or backend safeguard, is currently active.

## Good usage habits

- Keep conversations tied to the correct agent
- Use context intentionally
- Do not spam reconnects or repeated retries
- Check logs when the UI shows repeated connection issues
