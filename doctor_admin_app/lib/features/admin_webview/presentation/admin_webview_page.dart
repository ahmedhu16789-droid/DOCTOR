import 'package:doctor_admin_app/config/app_config.dart';
import 'dart:convert';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_windows/webview_windows.dart';

import 'whatsapp_automation_dialog.dart';

class AdminWebViewPage extends StatefulWidget {
  const AdminWebViewPage({super.key, required this.config});

  final AppConfig config;

  @override
  State<AdminWebViewPage> createState() => _AdminWebViewPageState();
}

class _AdminWebViewPageState extends State<AdminWebViewPage> {
  final _controller = WebviewController();
  bool _isWebviewInitialized = false;

  final List<WhatsAppMessage> _whatsappQueue = [];
  bool _isProcessingWhatsApp = false;
  bool _isWhatsAppVisible = false;

  @override
  void initState() {
    super.initState();
    _initWebview();
  }

  Future<void> _initWebview() async {
    try {
      await _controller.initialize();
      await _controller.setPopupWindowPolicy(WebviewPopupWindowPolicy.allow);

      _controller.webMessage.listen((event) {
        debugPrint('WebView received message: $event');
        try {
          final data = jsonDecode(event);
          if (data['type'] == 'WHATSAPP_BATCH' && data['messages'] != null) {
            final messages = (data['messages'] as List)
                .map((m) => WhatsAppMessage.fromJson(m as Map<String, dynamic>))
                .toList();

            if (messages.isNotEmpty && mounted) {
              setState(() {
                _whatsappQueue.addAll(messages);
                _isProcessingWhatsApp = true;
                _isWhatsAppVisible = false; // Start in background; only show when login/QR is needed
              });
            }
          }
        } catch (e) {
          debugPrint('Failed to parse webMessage: $e');
        }
      });

      await _controller.loadUrl(widget.config.adminPanelUrl);

      if (!mounted) return;
      setState(() {
        _isWebviewInitialized = true;
      });
    } on PlatformException catch (e) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Error'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Code: ${e.code}'),
                Text('Message: ${e.message}'),
              ],
            ),
            actions: [
              TextButton(
                child: const Text('Continue'),
                onPressed: () {
                  Navigator.of(context).pop();
                },
              )
            ],
          ),
        );
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _onRefresh() async {
    if (_isWebviewInitialized) {
      await _controller.reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Stack(
          children: [
            // Main Webview
            Positioned.fill(
              child: _isWebviewInitialized
                  ? Listener(
                      onPointerPanZoomUpdate: (event) {
                        final dy = -event.panDelta.dy;
                        final dx = -event.panDelta.dx;
                        if (dy != 0 || dx != 0) {
                          final position = event.localPosition;
                          final js = '''
                            (function() {
                              try {
                                var x = ${position.dx};
                                var y = ${position.dy};
                                var el = document.elementFromPoint(x, y);
                                while (el && el !== document.body && el !== document.documentElement) {
                                  var style = window.getComputedStyle(el);
                                  var isScrollableY = (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
                                  var isScrollableX = (style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth;

                                  if (isScrollableY || isScrollableX) {
                                    if (isScrollableY) el.scrollTop += $dy;
                                    if (isScrollableX) el.scrollLeft += $dx;
                                    return;
                                  }
                                  el = el.parentElement;
                                }
                                window.scrollBy($dx, $dy);
                              } catch (e) {
                                console.error('Scroll injection error:', e);
                              }
                            })();
                          ''';
                          _controller.executeScript(js);
                        }
                      },
                      child: Webview(_controller),
                    )
                  : const Center(child: CircularProgressIndicator()),
            ),

            // Internal Background Worker for WhatsApp
            if (_isProcessingWhatsApp)
              Positioned.fill(
                child: IgnorePointer(
                  ignoring: !_isWhatsAppVisible,
                  child: AnimatedOpacity(
                    opacity: _isWhatsAppVisible ? 1 : 0.01,
                    duration: const Duration(milliseconds: 250),
                    child: Align(
                      alignment: Alignment.center,
                      child: Container(
                        decoration: _isWhatsAppVisible
                            ? BoxDecoration(
                                color: Colors.white,
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withOpacity(0.2),
                                    blurRadius: 10,
                                    spreadRadius: 5,
                                  )
                                ],
                                borderRadius: BorderRadius.circular(12),
                              )
                            : null,
                        width: _isWhatsAppVisible ? 800 : 10,
                        height: _isWhatsAppVisible ? 600 : 10,
                        child: WhatsAppAutomationDialog(
                          messages: List.from(_whatsappQueue),
                          onNeedsLogin: () {
                            debugPrint('onNeedsLogin called! _isWhatsAppVisible: $_isWhatsAppVisible');
                            if (!_isWhatsAppVisible && mounted) {
                              setState(() {
                                _isWhatsAppVisible = true;
                              });
                            }
                          },
                          onLoggedIn: () {
                            debugPrint('onLoggedIn called! _isWhatsAppVisible: $_isWhatsAppVisible');
                            // Move to background mode after login, while keeping a tiny mounted webview alive.
                            if (_isWhatsAppVisible && mounted) {
                              setState(() {
                                _isWhatsAppVisible = false;
                              });
                            }
                          },
                          onCompleted: () {
                            if (mounted) {
                              setState(() {
                                _whatsappQueue.clear();
                                _isProcessingWhatsApp = false;
                                _isWhatsAppVisible = false;
                              });
                            }
                          },
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
