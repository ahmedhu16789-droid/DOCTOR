# Doctor Admin App

تطبيق Flutter يعرض لوحة التحكم داخل WebView بشكل قابل للتشغيل محليًا وفي بيئة الإنتاج.

## Architecture

- `lib/config/app_config.dart`: مسؤول عن قراءة رابط لوحة التحكم من متغيرات البيئة.
- `lib/features/admin_webview/presentation/admin_webview_page.dart`: شاشة الـ WebView مع تحميل، إعادة تحميل، وسحب للتحديث.
- `lib/app/app.dart`: تجميع إعدادات التطبيق وربطها بالشاشة الرئيسية.
- `lib/main.dart`: نقطة تشغيل التطبيق وحقن الإعدادات.

## Run

```bash
flutter pub get
flutter run
```

### Dev URL (default)
بدون أي إعدادات إضافية، التطبيق يفتح:

```text
http://localhost:3000/
```

### Production URL
مرّر الدومين وقت البناء أو التشغيل باستخدام `--dart-define`:

```bash
flutter run --dart-define=ADMIN_PANEL_URL=https://admin.example.com/
```

أو وقت الـ build:

```bash
flutter build apk --dart-define=ADMIN_PANEL_URL=https://admin.example.com/
```

## Platform Notes

- Android: تم تفعيل `INTERNET` + `usesCleartextTraffic=true` لدعم localhost أثناء التطوير.
- iOS: تم تفعيل `NSAllowsArbitraryLoadsInWebContent` لدعم روابط HTTP داخل WebView أثناء التطوير.
