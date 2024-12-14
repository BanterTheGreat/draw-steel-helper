export class SocketHelper {
    // SocketLib helpscripts. Only used by GMs
    static async deleteMessage(id) {
        const message = game.messages.get(id);
        if(message) {
            await message.delete();
        }
    }

    static async updateMessage(id, newMessage) {
        const message = game.messages.get(id);
        if (message) {
            await message.update({...newMessage});
        }
    }
}