import 'package:doctor_admin_app/config/app_config.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class AdminWebViewPage extends StatefulWidget {
  const AdminWebViewPage({super.key, required this.config});

  final AppConfig config;

  @override
  State<AdminWebViewPage> createState() => _AdminWebViewPageState();
}

class _AdminWebViewPageState extends State<AdminWebViewPage> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();

    final initialUri = Uri.parse(widget.config.adminPanelUrl);

    _controller =
        WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(Colors.transparent)
          ..setNavigationDelegate(
            NavigationDelegate(
              onPageStarted: (_) => _setLoadingState(true),
              onPageFinished: (_) => _setLoadingState(false),
              onWebResourceError: (_) => _setLoadingState(false),
            ),
          )
          ..loadRequest(initialUri);
  }

  Future<void> _onRefresh() => _controller.reload();

  void _setLoadingState(bool isLoading) {
    if (!mounted) {
      return;
    }

    setState(() {
      _isLoading = isLoading;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Doctor Admin'),
        actions: [
          IconButton(
            tooltip: 'Reload',
            onPressed: _controller.reload,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            RefreshIndicator(
              onRefresh: _onRefresh,
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  SizedBox(
                    height: MediaQuery.sizeOf(context).height,
                    child: WebViewWidget(controller: _controller),
                  ),
                ],
              ),
            ),
            if (_isLoading) const Center(child: CircularProgressIndicator()),
          ],
        ),
      ),
    );
  }
}
