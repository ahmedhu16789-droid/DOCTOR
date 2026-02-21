import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_windows/webview_windows.dart';

class WhatsAppMessage {
  final String phone;
  final String text;

  WhatsAppMessage({required this.phone, required this.text});

  factory WhatsAppMessage.fromJson(Map<String, dynamic> json) {
    return WhatsAppMessage(
      phone: json['phone'].toString(),
      text: json['text'].toString(),
    );
  }
}

class WhatsAppAutomationDialog extends StatefulWidget {
  final List<WhatsAppMessage> messages;
  final VoidCallback? onCompleted;

  const WhatsAppAutomationDialog({super.key, required this.messages, this.onCompleted});

  @override
  State<WhatsAppAutomationDialog> createState() => _WhatsAppAutomationDialogState();
}

class _WhatsAppAutomationDialogState extends State<WhatsAppAutomationDialog> {
  final _controller = WebviewController();
  bool _initialized = false;
  int _currentIndex = 0;
  String _statusMessage = 'Initializing...';
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _initWebview();
  }

  Future<void> _initWebview() async {
    try {
      await _controller.initialize();
      if (!mounted) return;
      setState(() {
        _initialized = true;
      });
      _processNextMessage();
    } on PlatformException catch (e) {
      debugPrint('Webview init error: $e');
      widget.onCompleted?.call();
    }
  }

  void _processNextMessage() async {
    if (_currentIndex >= widget.messages.length) {
      if (mounted) {
        setState(() {
          _statusMessage = 'All messages sent successfully!';
        });
        await Future.delayed(const Duration(seconds: 2));
        widget.onCompleted?.call();
      }
      return;
    }

    final msg = widget.messages[_currentIndex];
    setState(() {
      _statusMessage = 'Processing ${msg.phone} (${_currentIndex + 1}/${widget.messages.length})';
    });

    final encodedText = Uri.encodeComponent(msg.text);
    await _controller.loadUrl('https://web.whatsapp.com/send?phone=${msg.phone}&text=$encodedText');

    _pollingTimer?.cancel();
    _pollingTimer = Timer.periodic(const Duration(seconds: 2), (timer) async {
      if (!mounted) {
        timer.cancel();
        return;
      }
      try {
        // Checking if the page is ready. We look for the send button or an invalid popup.
        final script = '''
          (function() {
            var sendBtn = document.querySelector('span[data-icon="send"]');
            var invalidNumber = document.querySelector('div[data-animate-modal-popup="true"]');
            
            if (sendBtn) {
              var btn = sendBtn.closest('button') || sendBtn.parentElement;
              if (btn) btn.click();
              return 'SENT';
            }
            if (invalidNumber) {
              // Click the OK button on the invalid number popup to clear it
              var okBtn = invalidNumber.querySelector('button');
              if (okBtn) okBtn.click();
              return 'INVALID';
            }
            return 'WAITING';
          })();
        ''';
        final result = await _controller.executeScript(script);
        
        if (result == 'SENT') {
          timer.cancel();
          // Give WhatsApp time to actually send the message over the network
          await Future.delayed(const Duration(seconds: 3));
          if (mounted) {
            setState(() {
              _currentIndex++;
            });
            _processNextMessage();
          }
        } else if (result == 'INVALID') {
          timer.cancel();
          debugPrint('Invalid phone number: ${msg.phone}');
          if (mounted) {
            setState(() {
              _currentIndex++;
            });
            _processNextMessage();
          }
        }
      } catch (e) {
        // Ignore JS execution errors while page is loading
      }
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
        width: 1000,
        height: 700,
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('WhatsApp Automation Queue', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () {
                    _pollingTimer?.cancel();
                    widget.onCompleted?.call();
                  },
                )
              ],
            ),
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.blue.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.blue.shade200),
              ),
              child: Row(
                children: [
                  const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      _statusMessage,
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: _initialized 
                    ? Webview(_controller) 
                    : const Center(child: CircularProgressIndicator()),
              ),
            ),
          ],
        ),
      );
  }
}
