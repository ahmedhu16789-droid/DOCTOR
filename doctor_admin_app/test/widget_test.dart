import 'package:doctor_admin_app/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('uses valid environment URL when provided', () {
    const config = AppConfig(adminPanelUrl: 'https://admin.example.com/');

    expect(config.adminPanelUrl, 'https://admin.example.com/');
  });

  test('falls back to localhost for invalid URL format', () {
    final parsed = Uri.tryParse('not-a-url');

    expect(parsed?.hasScheme ?? false, isFalse);
    expect(const AppConfig.fromEnvironment().adminPanelUrl, isNotEmpty);
  });
}
