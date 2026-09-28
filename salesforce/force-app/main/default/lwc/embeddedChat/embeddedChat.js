import { LightningElement, api } from 'lwc';
export default class EmbeddedChat extends LightningElement {
    @api chatOrigin = 'https://chat.example.com';
    @api room = 'general';
    @api recordId;
    get chatUrl() {
        return `${this.chatOrigin.replace(/\/$/, '')}/embed?room=${encodeURIComponent(this.recordId || this.room)}`;
    }
}
