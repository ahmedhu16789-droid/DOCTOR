class AppConfig {
  const AppConfig({required this.adminPanelUrl});

  static const String _adminPanelUrlKey = 'ADMIN_PANEL_URL';
  static const String _defaultAdminPanelUrl = 'http://localhost:3000/';

  final String adminPanelUrl;

  factory AppConfig.fromEnvironment() {
    final rawUrl =
        const String.fromEnvironment(
          _adminPanelUrlKey,
          defaultValue: _defaultAdminPanelUrl,
        ).trim();

    final parsedUrl = Uri.tryParse(rawUrl);
    if (parsedUrl == null || !parsedUrl.hasScheme || parsedUrl.host.isEmpty) {
      return const AppConfig(adminPanelUrl: _defaultAdminPanelUrl);
    }

    return AppConfig(adminPanelUrl: parsedUrl.toString());
  }
}
