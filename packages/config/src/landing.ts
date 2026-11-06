import { BRAND_COPY } from "./brand.js";

export type GalleryCategory =
  | "outreach"
  | "welfare"
  | "celebration"
  | "reunion"
  | "community"
  | "giving";

export type GalleryItem = {
  id: string;
  title: string;
  description: string;
  /** Display date, e.g. "March 2025" */
  date: string;
  /** Path under the landing app `public/` folder, e.g. `/gallery/outreach.svg` */
  image: string;
  category: GalleryCategory;
  featured?: boolean;
};

export type LandingPillar = {
  title: string;
  description: string;
};

export const LANDING_PORTAL_URLS = {
  member: "https://member.osaja2020welfare.org",
  admin: "https://admin.osaja2020welfare.org",
  sms: "https://sms.osaja2020welfare.org",
  api: "https://api.osaja2020welfare.org",
} as const;

export const LANDING_COPY = {
  hero: {
    eyebrow: BRAND_COPY.batch,
    headline: BRAND_COPY.motto.replace(/\s*\|\s*/g, ". "),
    subheadline:
      "A united welfare family caring for one another — supporting members in need, celebrating milestones, and building a legacy of compassion that lasts beyond our school days.",
    ctaMember: "Member portal",
    ctaGallery: "See our activities",
  },
  vision: {
    title: "Our vision",
    body: "To be a model alumni welfare organisation — digitally connected, financially transparent, and deeply committed to the wellbeing of every member of the OSAJA'20 family, today and for generations to come.",
  },
  mission: {
    title: "Our mission",
    body: "To centralise member care, digitise welfare operations, strengthen communication, and ensure that no batch mate walks alone through life's challenges or celebrations.",
  },
  dream: {
    title: "Our dream",
    lead: "We dream of a batch that never loses touch.",
    body: "From the classrooms of Asuofua D/A JHS to careers, families, and communities across Ghana and beyond — we remain one family. Our dream is simple but powerful: when a member needs help, the family responds. When someone achieves, we celebrate together. When decisions matter, every voice is heard.",
    highlights: [
      "A welfare fund that members can trust — transparent, accountable, and fair.",
      "A digital home where updates, birthdays, votes, and support requests live in one place.",
      "Outreach and giving-back activities that honour our roots and uplift our community.",
      "A culture of dignity — supporting one another without stigma or silence.",
    ],
  },
  pillars: [
    {
      title: "Member welfare",
      description:
        "Timely support for members facing hardship — medical needs, bereavement, emergencies, and other genuine cases reviewed with care.",
    },
    {
      title: "Monthly contributions",
      description:
        "Structured dues and digital payments that keep the welfare fund healthy and every member's record clear and up to date.",
    },
    {
      title: "Community & outreach",
      description:
        "Reunions, school visits, and outreach programmes that keep the batch spirit alive and give back to Asuofua and beyond.",
    },
    {
      title: "Governance & voting",
      description:
        "Democratic decisions on leadership, policies, and welfare matters — transparent ballots and results every member can see.",
    },
    {
      title: "Celebrations",
      description:
        "Birthdays, achievements, and milestones remembered — because a family that celebrates together stays together.",
    },
    {
      title: "Transparency",
      description:
        "Clear reporting, executive oversight, and a platform built for trust — so members always know how welfare resources are used.",
    },
  ] satisfies LandingPillar[],
  join: {
    title: "Ready to connect?",
    body: "Active members sign in to the member portal for contributions, welfare requests, voting, announcements, and more.",
    memberLabel: "Member sign in",
  },
  gallery: {
    title: "Gallery",
    subtitle: "Moments from our welfare journey — outreach, celebrations, reunions, and the activities that keep our batch family strong.",
    hint: "To add photos: place images in the landing app's public/gallery/ folder and update GALLERY_ITEMS in packages/config/src/landing.ts.",
  },
  footer: {
    tagline: BRAND_COPY.tagline,
    rights: `© ${new Date().getFullYear()} ${BRAND_COPY.name} ${BRAND_COPY.welfare}. All rights reserved.`,
  },
} as const;

/**
 * Gallery entries — real African community photos from Pexels.
 * Featured items appear larger in the grid.
 */
export const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "community-gathering",
    title: "Community gathering",
    description: "An elder leading a community gathering — wisdom, guidance, and collective listening.",
    date: "2024",
    image: "/gallery/community-gathering.jpg",
    category: "community",
    featured: true,
  },
  {
    id: "school-outreach",
    title: "School community",
    description: "Children gathered at a school — the foundation of education and hope for tomorrow.",
    date: "2024",
    image: "/gallery/school-community.jpg",
    category: "outreach",
    featured: true,
  },
  {
    id: "family-celebration",
    title: "Family celebration",
    description: "Extended family celebrating under a tent — togetherness, joy, and African tradition.",
    date: "2024",
    image: "/gallery/family-celebration.jpg",
    category: "celebration",
  },
  {
    id: "charity-volunteers",
    title: "Charity volunteers",
    description: "Volunteers sorting donations — the spirit of giving and support that drives us forward.",
    date: "2024",
    image: "/gallery/charity-volunteer.jpg",
    category: "giving",
  },
];

export const GALLERY_CATEGORY_LABELS: Record<GalleryCategory, string> = {
  outreach: "Outreach",
  welfare: "Welfare",
  celebration: "Celebration",
  reunion: "Reunion",
  community: "Community",
  giving: "Giving",
};
