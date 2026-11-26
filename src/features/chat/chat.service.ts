import { getDataSource } from '@/api/adapters/data-source';
import type { ChatConversation } from '@/api/contracts';

export const chatService = {
  listConversations: (): Promise<ChatConversation[]> => getDataSource().listConversations(),
  createConversation: (itineraryId?: string | null): Promise<ChatConversation> =>
    getDataSource().createConversation(itineraryId),
  sendMessage: (conversationId: string, content: string): Promise<ChatConversation> =>
    getDataSource().sendChatMessage(conversationId, content),
  retryMessage: (conversationId: string, failedUserMessageId: string): Promise<ChatConversation> =>
    getDataSource().retryChatMessage(conversationId, failedUserMessageId),
};
