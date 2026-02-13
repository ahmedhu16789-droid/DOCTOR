import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// English translations
import { common as enCommon } from './src/locales/en/common';
import { admin as enAdmin } from './src/locales/en/admin';
import { booking as enBooking } from './src/locales/en/booking';
import { medical as enMedical } from './src/locales/en/medical';

// Arabic translations
import { common as arCommon } from './src/locales/ar/common';
import { admin as arAdmin } from './src/locales/ar/admin';
import { booking as arBooking } from './src/locales/ar/booking';
import { medical as arMedical } from './src/locales/ar/medical';

// Define translations
const resources = {
  en: {
    translation: {
      ...enCommon,
      ...enAdmin,
      ...enBooking,
      ...enMedical
    }
  },
  ar: {
    translation: {
      ...arCommon,
      ...arAdmin,
      ...arBooking,
      ...arMedical
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;