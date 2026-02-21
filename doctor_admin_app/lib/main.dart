import 'package:doctor_admin_app/app/app.dart';
import 'package:doctor_admin_app/config/app_config.dart';
import 'package:flutter/material.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(DoctorAdminApp(config: AppConfig.fromEnvironment()));
}
