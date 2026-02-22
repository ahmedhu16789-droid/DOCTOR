import 'dart:async';
import 'dart:convert';
import 'dart:math';
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
  bool _isWhatsAppBootstrapped = false;
  final _random = Random();

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


  String _normalizePhone(String phone) {
    final digits = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (digits.isEmpty) return phone;

    var cleaned = digits;
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);

    if (cleaned.startsWith('20')) return cleaned;
    if (cleaned.startsWith('0') && cleaned.length >= 10) return '20${cleaned.substring(1)}';
    if (cleaned.length == 10 || cleaned.length == 11) return '20$cleaned';

    return cleaned;
  }

  Future<bool> _bootstrapWhatsAppShell() async {
    if (_isWhatsAppBootstrapped) return true;

    await _controller.loadUrl('https://web.whatsapp.com/');
    await _waitForPageLoad(timeout: const Duration(seconds: 40));

    for (int i = 0; i < 40; i++) {
      final state = await _executeScriptWithRetry(r"""
        (function() {
          var body = document.body;
          if (!body) return 'NO_BODY';
          var bodyLen = (body.innerText || '').length + (body.innerHTML || '').length;
          var hasQr = !!document.querySelector('[data-ref]');
          var hasSide = !!document.querySelector('#pane-side');
          var hasLanding = !!document.querySelector('[data-testid="chat-list-search"]');
          if (hasQr) return 'NEEDS_LOGIN';
          if (hasSide || hasLanding) return 'READY';
          if (bodyLen > 2000) return 'PARTIAL';
          return 'BLANK';
        })();
      """, retries: 1, delay: const Duration(milliseconds: 1));

      if (state == 'READY' || state == 'NEEDS_LOGIN' || state == 'PARTIAL') {
        _isWhatsAppBootstrapped = true;
        return true;
      }
      await Future.delayed(const Duration(milliseconds: 800));
    }

    return false;
  }

  Future<String?> _executeScriptWithRetry(
    String script, {
    int retries = 12,
    Duration delay = const Duration(milliseconds: 700),
  }) async {
    for (int i = 0; i < retries; i++) {
      final result = await _controller.executeScript(script);
      final value = result?.toString().trim();
      if (value != null && value.isNotEmpty && value != 'null') {
        return value;
      }
      await Future.delayed(delay);
    }
    return null;
  }

  Future<bool> _waitForComposerReady() async {
    for (int i = 0; i < 50; i++) {
      final state = await _executeScriptWithRetry(r'''
        (function() {
          if (document.querySelector('[data-ref]')) return 'NEEDS_LOGIN';

          var composer = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                         document.querySelector('[data-tab="10"][contenteditable="true"]') ||
                         document.querySelector('footer [contenteditable="true"]') ||
                         document.querySelector('[contenteditable="true"][role="textbox"]');

          if (!composer) return 'WAITING_CHAT';

          var rect = composer.getBoundingClientRect();
          var visible = rect.width > 0 && rect.height > 0;
          return visible ? 'CHAT_READY' : 'CHAT_HIDDEN';
        })();
      ''', retries: 1, delay: const Duration(milliseconds: 1));

      if (state == 'CHAT_READY') return true;
      if (state == 'NEEDS_LOGIN') return false;
      await Future.delayed(const Duration(milliseconds: 800));
    }
    return false;
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
      final normalizedPhone = _normalizePhone(msg.phone);
      final url = 'https://web.whatsapp.com/send?phone=$normalizedPhone';

      final bootstrapReady = await _bootstrapWhatsAppShell();
      if (!bootstrapReady) {
        throw Exception('WhatsApp shell failed to initialize.');
      }

      // --- Load the page and wait for it to complete ---
      await _controller.loadUrl(url);
      await _waitForPageLoad(timeout: const Duration(seconds: 35));
      debugPrint('WA: Page loaded for ${msg.phone} (normalized: $normalizedPhone)');

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
        await _waitForPageLoad(timeout: const Duration(seconds: 35));
      } else {
        widget.onLoggedIn?.call();
      }

      var chatReady = await _waitForComposerReady();
      if (!chatReady) {
        final fallbackUrl = 'https://web.whatsapp.com/send?phone=$normalizedPhone&text=${Uri.encodeComponent(msg.text)}';
        debugPrint('WA: Composer not ready. Retrying with fallback url...');
        await _controller.loadUrl(fallbackUrl);
        await _waitForPageLoad(timeout: const Duration(seconds: 35));
        chatReady = await _waitForComposerReady();
      }
      if (!chatReady) {
        throw Exception('Chat is not ready for ${msg.phone} (normalized: $normalizedPhone).');
      }

      final messageTextJson = jsonEncode(msg.text);
      final fillResult = await _executeScriptWithRetry('''
        (function() {
          var message = $messageTextJson;
          var composer = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                         document.querySelector('[data-tab="10"][contenteditable="true"]') ||
                         document.querySelector('footer [contenteditable="true"]') ||
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

          return 'TEXT_READY:' + composer.tagName;
        })();
      ''', retries: 8, delay: const Duration(milliseconds: 900));
      debugPrint('WA Fill: $fillResult');
      if (fillResult == null || !fillResult.startsWith('TEXT_READY')) {
        throw Exception('Failed to fill message composer for ${msg.phone}. result=$fillResult');
      }

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
      final domDebug = await _executeScriptWithRetry(r'''
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
      ''', retries: 6, delay: const Duration(milliseconds: 700));
      debugPrint('WA DOM Debug: $domDebug');

      // --- Try to send the message ---
      final sendResult = await _executeScriptWithRetry(r'''
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
                         document.querySelector('[data-tab="10"][contenteditable="true"]') ||
                         document.querySelector('footer [contenteditable="true"]') ||
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
      ''', retries: 10, delay: const Duration(milliseconds: 700));
      debugPrint('WA Send: $sendResult');
      if (sendResult == null || sendResult == 'NOTHING_FOUND') {
        throw Exception('Failed to trigger WhatsApp send action for ${msg.phone}. result=$sendResult');
      }

      // Wait between messages with a human-like random delay (4s..25s)
      final waitSeconds = 4 + _random.nextInt(22);
      if (mounted) {
        setState(() {
          _statusMessage = '✓ Sent to ${msg.phone}. Waiting ${waitSeconds}s before next message...';
        });
      }
      await Future.delayed(Duration(seconds: waitSeconds));

      if (mounted) {
        setState(() {
          _currentIndex++;
          _statusMessage =
              'Processing next message (${_currentIndex + 1}/${widget.messages.length})...';
        });
      }
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
