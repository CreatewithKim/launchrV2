export interface ConversationMessage {
  id: string;
  sender: "business" | "prospect";
  text: string;
  channel: "whatsapp" | "sms" | "email";
  timestamp: string;
}

export interface Conversation {
  id: string;
  ownerId: number;
  prospectId?: number;
  prospectName: string;
  company: string;
  phone: string;
  email?: string;
  channel: "whatsapp" | "sms" | "email";
  status: "active" | "replied" | "meeting_booked" | "converted" | "closed";
  intent?: "interested" | "pricing_question" | "objection" | "timing_issue" | "not_interested";
  messages: ConversationMessage[];
  lastMessageAt: string;
  followUpStep: number;
  followUpPaused: boolean;
}

// In-memory conversation store (development only, starts empty).
// TODO(batch 2): persist conversations/messages in MySQL and connect a real
// messaging provider; nothing here is sent anywhere yet.
const memoryConversations: Conversation[] = [];

export function listConversations(ownerId: number): Conversation[] {
  return memoryConversations
    .filter(c => c.ownerId === ownerId)
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

export function getConversation(ownerId: number, id: string): Conversation | undefined {
  return memoryConversations.find(c => c.ownerId === ownerId && c.id === id);
}

export function createOrGetConversation(ownerId: number, params: {
  prospectId?: number;
  prospectName: string;
  company: string;
  phone: string;
  email?: string;
  channel: "whatsapp" | "sms" | "email";
  initialOutreach?: string;
}): Conversation {
  let existing = memoryConversations.find(
    c => c.ownerId === ownerId && (c.phone === params.phone || (params.prospectId && c.prospectId === params.prospectId))
  );

  if (existing) {
    if (params.initialOutreach) {
      existing.messages.push({
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        sender: "business",
        text: params.initialOutreach,
        channel: params.channel,
        timestamp: new Date().toISOString(),
      });
      existing.lastMessageAt = new Date().toISOString();
    }
    return existing;
  }

  const newConvo: Conversation = {
    id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    ownerId,
    prospectId: params.prospectId,
    prospectName: params.prospectName,
    company: params.company,
    phone: params.phone,
    email: params.email,
    channel: params.channel,
    status: "active",
    messages: params.initialOutreach
      ? [
          {
            id: `msg_${Date.now()}`,
            sender: "business",
            text: params.initialOutreach,
            channel: params.channel,
            timestamp: new Date().toISOString(),
          },
        ]
      : [],
    lastMessageAt: new Date().toISOString(),
    followUpStep: 1,
    followUpPaused: false,
  };

  memoryConversations.unshift(newConvo);
  return newConvo;
}

export function addMessageToConversation(ownerId: number, params: {
  conversationId: string;
  sender: "business" | "prospect";
  text: string;
  channel?: "whatsapp" | "sms" | "email";
  intent?: Conversation["intent"];
}): Conversation {
  const convo = memoryConversations.find(c => c.ownerId === ownerId && c.id === params.conversationId);
  if (!convo) throw new Error("Conversation not found");

  convo.messages.push({
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    sender: params.sender,
    text: params.text,
    channel: params.channel || convo.channel,
    timestamp: new Date().toISOString(),
  });

  convo.lastMessageAt = new Date().toISOString();

  if (params.sender === "prospect") {
    convo.status = "replied";
    convo.followUpPaused = true; // Auto-pause follow-ups when prospect replies!
    if (params.intent) convo.intent = params.intent;
  }

  return convo;
}

export function updateConversationStatus(ownerId: number, id: string, status: Conversation["status"]): Conversation {
  const convo = memoryConversations.find(c => c.ownerId === ownerId && c.id === id);
  if (!convo) throw new Error("Conversation not found");
  convo.status = status;
  return convo;
}
