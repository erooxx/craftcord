import { Message, MessageComponentType, MappedInteractionTypes } from "discord.js";

// Replaces the createMessageComponentCollector + on("collect") + on("end")
// trio that was hand-copied at every single-button/select-menu step in the
// bot (with the timeout branch drifting out of sync at least once — see
// setup's locale-picker timeout). One await, null on timeout.
export async function awaitSingleComponent<T extends MessageComponentType>(
    message: Message,
    componentType: T,
    userId: string,
): Promise<MappedInteractionTypes<boolean>[T] | null> {
    try {
        return await message.awaitMessageComponent<T>({
            componentType,
            filter: (i) => i.user.id === userId,
            time: 60_000,
        });
    } catch {
        return null;
    }
}
