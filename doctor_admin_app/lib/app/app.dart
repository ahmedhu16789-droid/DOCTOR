import 'package:doctor_admin_app/config/app_config.dart';
import 'package:doctor_admin_app/features/admin_webview/presentation/admin_webview_page.dart';
import 'package:flutter/material.dart';

class DoctorAdminApp extends StatelessWidget {
  const DoctorAdminApp({super.key, required this.config});

  final AppConfig config;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Doctor Admin App',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0E7490)),
      ),
      home: AdminWebViewPage(config: config),
    );
  }
}
