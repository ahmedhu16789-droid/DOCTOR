import 'dart:async';
import 'dart:convert';
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
  final VoidCallback? onNeedsLogin;
  final VoidCallback? onLoggedIn;

  const WhatsAppAutomationDialog({
    super.key,
    required this.messages,
    this.onCompleted,
    this.onNeedsLogin,
    this.onLoggedIn,
  });

  @override
  State<WhatsAppAutomationDialog> createState() => _WhatsAppAutomationDialogState();
}

class _WhatsAppAutomationDialogState extends State<WhatsAppAutomationDialog> {
  final _controller = WebviewController();
  bool _initialized = false;
  bool _isProcessing = false;
  int _currentIndex = 0;
  String _statusMessage = 'Initializing...';
  StreamSubscription<LoadingState>? _loadingSubscription;

  @override
  void initState() {
    super.initState();
    _initWebview();
  }

  Future<void> _initWebview() async {
    try {
      await _controller.initialize();
      await _controller.setPopupWindowPolicy(WebviewPopupWindowPolicy.allow);
      if (!mounted) return;
      setState(() {
        _initialized = true;
        _statusMessage = 'Ready. Loading WhatsApp...';
      });
      _processNextMessage();
    } on PlatformException catch (e) {
      debugPrint('Webview init error: $e');
      if (e.code == 'environment_already_initialized') {
        if (!mounted) return;
        setState(() {
          _initialized = true;
          _statusMessage = 'Ready. Loading WhatsApp...';
        });
        _processNextMessage();
        return;
      }
      widget.onCompleted?.call();
    }
  }

  /// Waits until the webview's loading state becomes navigationCompleted.
  Future<void> _waitForPageLoad({Duration timeout = const Duration(seconds: 20)}) async {
    final completer = Completer<void>();
    StreamSubscription<LoadingState>? sub;
    final timer = Timer(timeout, () {
      sub?.cancel();
      if (!completer.isCompleted) completer.complete();
    });
    sub = _controller.loadingState.listen((state) {
      debugPrint('WA LoadingState: $state');
      if (state == LoadingState.navigationCompleted) {
        timer.cancel();
        sub?.cancel();
        if (!completer.isCompleted) completer.complete();
      }
    });
    await completer.future;
    // Give React components extra time to render after navigation completes
    await Future.delayed(const Duration(seconds: 5));
  }

  void _processNextMessage() async {
    if (_isProcessing) return;
    if (_currentIndex >= widget.messages.length) {
      if (mounted) {
        setState(() => _statusMessage = 'All messages sent! ✓');
        await Future.delayed(const Duration(seconds: 2));
        widget.onCompleted?.call();
      }
      return;
    }

    _isProcessing = true;
    final msg = widget.messages[_currentIndex];
    if (mounted) {
      setState(() => _statusMessage = 'Processing ${msg.phone} (${_currentIndex + 1}/${widget.messages.length})...');
    }

    try {
      final url = 'https://web.whatsapp.com/send?phone=${msg.phone}';

      // --- Load the page and wait for it to complete ---
      await _controller.loadUrl(url);
      await _waitForPageLoad();
      debugPrint('WA: Page loaded for ${msg.phone}');

      // --- Check for QR / Login screen ---
      final loginCheck = await _controller.executeScript(r'''
        (function() {
          var qr = document.querySelector('[data-ref]');
          return qr ? 'NEEDS_LOGIN' : 'LOGGED_IN';
        })();
      ''');
      debugPrint('WA login check: $loginCheck');

      if (loginCheck?.toString().trim() == 'NEEDS_LOGIN') {
        widget.onNeedsLogin?.call();
        if (mounted) setState(() => _statusMessage = 'Please scan the QR code...');

        // Wait for QR to disappear (user logged in), check every 2s for up to 3 min
        bool loggedIn = false;
        for (int i = 0; i < 90 && mounted; i++) {
          await Future.delayed(const Duration(seconds: 2));
          final qrCheck = await _controller.executeScript(r'''
            document.querySelector('[data-ref]') ? 'QR' : 'OK';
          ''');
          if (qrCheck?.toString().trim() == 'OK') {
            loggedIn = true;
            widget.onLoggedIn?.call();
            break;
          }
        }
        if (!loggedIn) {
          _isProcessing = false;
          widget.onCompleted?.call();
          return;
        }

        // Reload after login and wait for page
        if (mounted) setState(() => _statusMessage = 'Logged in! Loading chat...');
        await _controller.loadUrl(url);
        await _waitForPageLoad();
      } else {
        widget.onLoggedIn?.call();
      }

      // Wait until composer is rendered in the chat page.
      String chatState = 'UNKNOWN';
      for (int i = 0; i < 25; i++) {
        final state = await _controller.executeScript(r'''
          (function() {
            if (document.querySelector('[data-ref]')) return 'NEEDS_LOGIN';
            var composer = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                           document.querySelector('[contenteditable="true"][role="textbox"]');
            return composer ? 'CHAT_READY' : 'WAITING_CHAT';
          })();
        ''');
        chatState = state?.toString().trim() ?? 'NULL';
        if (chatState == 'CHAT_READY' || chatState == 'NEEDS_LOGIN') break;
        await Future.delayed(const Duration(milliseconds: 800));
      }

      if (chatState != 'CHAT_READY') {
        throw Exception('Chat is not ready for ${msg.phone}. state=$chatState');
      }

      final messageTextJson = jsonEncode(msg.text);
      final fillResult = await _controller.executeScript('''
        (function() {
          var message = $messageTextJson;
          var composer = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                         document.querySelector('[contenteditable="true"][role="textbox"]');
          if (!composer) return 'COMPOSER_NOT_FOUND';

          composer.focus();
          try {
            composer.click();
            document.execCommand('insertText', false, message);
          } catch (e) {
            composer.textContent = message;
          }

          composer.dispatchEvent(new InputEvent('input', {
            bubbles: true,
            data: message,
            inputType: 'insertText'
          }));

          return 'TEXT_READY';
        })();
      ''');
      debugPrint('WA Fill: $fillResult');

      // --- Simulate human interaction to trigger React hydration ---
      // WhatsApp detects if window has focus; without it, React may not hydrate
      await _controller.executeScript(r'''
        (function() {
          // Force visibility state to visible
          try {
            Object.defineProperty(document, 'visibilityState', { get: function() { return 'visible'; } });
            Object.defineProperty(document, 'hidden', { get: function() { return false; } });
          } catch(e) {}
          
          // Fire window/document focus events (human-like)
          window.dispatchEvent(new Event('focus'));
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('pageshow'));
          
          // Simulate mouse movement over the page (triggers WhatsApp UI)
          var events = ['mousemove', 'mouseenter', 'pointermove', 'pointerover'];
          events.forEach(function(evType) {
            document.body.dispatchEvent(new MouseEvent(evType, {
              bubbles: true, cancelable: true,
              clientX: 500, clientY: 400,
              screenX: 500, screenY: 400
            }));
          });
          
          // Simulate a click on the center of the page
          setTimeout(function() {
            var centerEl = document.elementFromPoint(500, 400);
            if (centerEl) centerEl.click();
          }, 500);
        })();
      ''');
      
      // Wait for React to hydrate after human events
      await Future.delayed(const Duration(seconds: 5));
      debugPrint('WA: Human events injected, waiting for hydration...');

      // --- DEBUG: log DOM structure to find correct selectors ---
      final domDebug = await _controller.executeScript(r'''
        (function() {
          var info = 'visibility:' + document.visibilityState + ' bodyLen:' + document.body.innerHTML.length;
          // Dump all buttons
          var btns = document.querySelectorAll('button');
          info += ' buttons:' + btns.length;
          for (var i = 0; i < Math.min(btns.length, 5); i++) {
            info += ' btn' + i + '=[aria=' + (btns[i].getAttribute("aria-label")||"").substring(0,20) +
                    ' testid=' + (btns[i].getAttribute("data-testid")||"")+']';
          }
          // Dump all spans with data-icon
          var spans = document.querySelectorAll("span");
          var iconSpans = [];
          for (var s of spans) { if (s.getAttribute && s.getAttribute("data-icon")) iconSpans.push(s.getAttribute("data-icon")); }
          info += ' iconSpans:[' + iconSpans.slice(0,10).join(',') + ']';
          // Dump all divs with role
          var roles = document.querySelectorAll("[role]");
          var roleList = [];
          for (var r of roles) { roleList.push(r.tagName + ':' + r.getAttribute("role")); }
          info += ' roles:[' + roleList.slice(0,10).join(',') + ']';
          return info;
        })();
      ''');
      debugPrint('WA DOM Debug: $domDebug');

      // --- Try to send the message ---
      final sendResult = await _controller.executeScript(r'''
        (function() {
          // 1. Try data-icon send spans
          var spans = document.querySelectorAll("span");
          for (var s of spans) {
            if (s.getAttribute("data-icon") === "send" || s.getAttribute("data-icon") === "send-light") {
              var btn = s.closest("button") || s.parentElement;
              if (btn) { btn.click(); return "CLICKED_SPAN_DATA_ICON:"+s.getAttribute("data-icon"); }
            }
          }

          // 2. Try aria-label send buttons (English + Arabic)
          var sendLabels = ["Send", "إرسال", "send", "Send message"];
          var btns = document.querySelectorAll("button");
          for (var btn of btns) {
            var lbl = btn.getAttribute("aria-label") || "";
            if (sendLabels.some(function(l){ return lbl.includes(l); })) {
              btn.click();
              return "CLICKED_BTN_ARIA:"+lbl;
            }
          }

          // 3. Try data-testid
          var testIds = ["compose-btn-send", "send-btn", "msg-compose-send", "send", "compose-send"];
          for (var id of testIds) {
            var el = document.querySelector("[data-testid=\""+id+"\"]");
            if (el) { el.click(); return "CLICKED_TESTID:"+id; }
          }

          // 4. Simulate Enter on compose textbox.
          var composer = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                         document.querySelector('[contenteditable="true"][role="textbox"]');
          if (composer) {
            composer.focus();
            composer.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter", code:"Enter", keyCode:13, which:13, bubbles:true}));
            composer.dispatchEvent(new KeyboardEvent("keypress", {key:"Enter", code:"Enter", keyCode:13, which:13, bubbles:true}));
            composer.dispatchEvent(new KeyboardEvent("keyup", {key:"Enter", code:"Enter", keyCode:13, which:13, bubbles:true}));
            return "ENTER_ON_COMPOSER";
          }

          // 5. Last resort: press Enter on the last focused element
          if (document.activeElement && document.activeElement !== document.body) {
            document.activeElement.dispatchEvent(new KeyboardEvent("keydown", {key:"Enter",code:"Enter",keyCode:13,which:13,bubbles:true}));
            return "ENTER_ACTIVE:" + document.activeElement.tagName;
          }

          return "NOTHING_FOUND";
        })();
      ''');
      debugPrint('WA Send: $sendResult');

      // Wait for message to be sent and move to next
      await Future.delayed(const Duration(seconds: 4));

      if (mounted) {
        setState(() {
          _statusMessage = '✓ Sent to ${msg.phone}';
          _currentIndex++;
        });
      }
      await Future.delayed(const Duration(seconds: 1));
      _isProcessing = false;
      _processNextMessage();
    } catch (e) {
      debugPrint('WA Error [${msg.phone}]: $e');
      _isProcessing = false;
      _currentIndex++;
      _processNextMessage();
    }
  }

  @override
  void dispose() {
    _loadingSubscription?.cancel();
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
              Text('WhatsApp Automation',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold)),
              IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => widget.onCompleted?.call()),
            ],
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.green.shade300),
            ),
            child: Row(
              children: [
                const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
                const SizedBox(width: 16),
                Expanded(
                    child: Text(_statusMessage,
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green))),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: _initialized ? Webview(_controller) : const Center(child: CircularProgressIndicator()),
            ),
          ),
        ],
      ),
    );
  }
}
