import type { LandingData } from "@/types/landing";

export function getLandingJsonLd(data: LandingData) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "MedicalClinic",
        name: data.brand.name,
        description: data.seo.description,
        url: data.seo.canonical,
        telephone: data.booking.contact.phone,
        address: data.booking.contact.address,
        email: data.booking.contact.email,
      },
      {
        "@type": "ItemList",
        itemListElement: data.doctors.items.map((doctor, index) => ({
          "@type": "Physician",
          position: index + 1,
          name: doctor.name,
          medicalSpecialty: doctor.specialty,
          image: doctor.imageSrc,
        })),
      },
      {
        "@type": "OfferCatalog",
        name: "Medical Services",
        itemListElement: data.specialties.items.map((specialty) => ({
          "@type": "Offer",
          itemOffered: {
            "@type": "MedicalProcedure",
            name: specialty.title,
            description: specialty.description,
          },
        })),
      },
    ],
  };
}
