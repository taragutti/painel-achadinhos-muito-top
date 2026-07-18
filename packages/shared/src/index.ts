import { z } from "zod";

export const channelSchema = z.enum(["telegram", "whatsapp", "test"]);
export type Channel = z.infer<typeof channelSchema>;

export const publicationPayloadSchema = z.object({
  publicationId: z.string().min(1),
  destination: z.string().min(1),
  text: z.string().min(1).max(4096),
  link: z.url().optional(),
});
export type PublicationPayload = z.infer<typeof publicationPayloadSchema>;

export type PublicationResult = {
  success: boolean;
  externalId?: string;
  detail?: string;
};

export interface PublicationProvider {
  readonly name: string;
  publish(payload: PublicationPayload): Promise<PublicationResult>;
}
