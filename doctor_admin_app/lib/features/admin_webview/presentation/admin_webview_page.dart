import 'package:doctor_admin_app/config/app_config.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:webview_windows/webview_windows.dart';

class AdminWebViewPage extends StatefulWidget {
  const AdminWebViewPage({super.key, required this.config});

  final AppConfig config;

  @override
  State<AdminWebViewPage> createState() => _AdminWebViewPageState();
}

class _AdminWebViewPageState extends State<AdminWebViewPage> {
  final _controller = WebviewController();
  bool _isWebviewInitialized = false;

  @override
  void initState() {
    super.initState();
    _initWebview();
  }

  Future<void> _initWebview() async {
    try {
      await _controller.initialize();
      await _controller.setBackgroundColor(Colors.transparent);
      await _controller.setPopupWindowPolicy(WebviewPopupWindowPolicy.deny);
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
      backgroundColor: Colors.transparent,
      body: SafeArea(
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
    );
  }
}
