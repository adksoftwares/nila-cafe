# Nila Cafe — Native Android migration

The Android entry point is now a Kotlin Activity with a Jetpack Compose interface. The old Capacitor BridgeActivity has been removed from the Android source set. The web POS remains available separately in `client/`.

## Android build

- Android Gradle Plugin 8.2.1
- Kotlin 1.9.22
- Jetpack Compose BOM 2024.02.01
- Minimum Android API 23; target API 34
- Native Gradle project; no WebView is used as the Android UI

Configure the real HTTPS API root in `client/android/gradle.properties`:

```properties
NILA_API_BASE_URL=https://YOUR_HOST/api/
```

The API root must end with a slash. Do not commit credentials, tokens, or private API keys.

## Current migration state

- Native Kotlin activity and Compose design system: added.
- Native POS workspace shell, category/search controls, order/cart presentation: added.
- Retrofit service contracts matching the existing `POST /api/auth/login` and `GET /api/products` backend routes: added.
- Web POS visual refresh: added.
- Demo credentials removed from the web sign-in form.
- Existing Express/PostgreSQL backend retained.

## Remaining integration before production use

The current native screen is a UI foundation, not a completed operational POS. Authentication and product API calls still need to be connected to the Compose state, followed by Room-backed offline sales, WorkManager synchronization, checkout/payment transaction mapping, role-aware screens, kitchen/order modules, and native Bluetooth/USB/network printer implementations. The backend remains the source of truth for prices, tax, permissions, and sale records.

No build, emulator, device, printer, or runtime testing has been performed, as requested.
