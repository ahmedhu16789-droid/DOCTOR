export interface WhatsAppMessage {
    phone: string;
    text: string;
}

/**
 * Sends a batch of WhatsApp messages to the Flutter desktop app via WebView.
 * It will open a queue dialog in the desktop app automatically.
 */
export const sendWhatsAppQueue = (messages: WhatsAppMessage[]) => {
    if (!messages || messages.length === 0) return;

    try {
        const payload = JSON.stringify({
            type: 'WHATSAPP_BATCH',
            messages,
        });

        // Check if we are running inside the webview_windows container (Flutter Desktop App)
        const win = window as any;
        if (win.chrome && win.chrome.webview && typeof win.chrome.webview.postMessage === 'function') {
            win.chrome.webview.postMessage(payload);
            console.log('Sent WhatsApp queue to WebView:', messages.length, 'messages');
        } else {
            console.log('Running outside WebView. Would send WhatsApp messages:', messages);
        }
    } catch (error) {
        console.error('Failed to post WhatsApp message to WebView:', error);
    }
};
