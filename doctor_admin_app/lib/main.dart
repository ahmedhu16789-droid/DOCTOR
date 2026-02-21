import 'package:doctor_admin_app/app/app.dart';
import 'package:doctor_admin_app/config/app_config.dart';
import 'package:flutter/material.dart';
import 'package:webview_windows/webview_windows.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set a real Chrome user agent at the WebView2 environment level.
  // This is required so that WhatsApp Web doesn't detect us as an embedded WebView2
  // and block rendering. JavaScript-level UA overrides are NOT enough.
  try {
    await WebviewController.initializeEnvironment(
      additionalArguments:
          '--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"',
    );
  } catch (e) {
    debugPrint('WebView2 environment init error: $e');
  }

  runApp(DoctorAdminApp(config: AppConfig.fromEnvironment()));
}
