export const SITE_URL = "https://awakemode.com";
export const SITE_NAME = "AwakeMode";
export const DEFAULT_TITLE = "Keep your computer awake";
export const DEFAULT_DESCRIPTION =
  "AwakeMode keeps your computer awake while browser sessions, downloads, renders, and automations are running.";
export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/icon.svg`,
  width: 512,
  height: 512,
  alt: "AwakeMode logo",
  type: "image/svg+xml",
};

export const COMPANY = {
  name: "AwakeMode",
  legalName: "AwakeMode",
  email: "hello@awakemode.com",
  logoUrl: `${SITE_URL}/icon.svg`,
  sameAs: [
    "https://x.com/AwakeModeApp",
    "https://www.linkedin.com/company/awakemode",
  ],
};

export const BLOG_AUTHOR = {
  name: "AwakeMode Team",
  url: `${SITE_URL}/team`,
  linkedInUrl: "",
};

export const TOOL_RATING = {
  value: 5,
  count: 1,
  best: 5,
  worst: 1,
};

export function toAbsoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, SITE_URL).toString();
}

export function createOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: COMPANY.name,
    legalName: COMPANY.legalName,
    url: SITE_URL,
    logo: COMPANY.logoUrl,
    email: COMPANY.email,
    sameAs: COMPANY.sameAs,
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: COMPANY.email,
        availableLanguage: "en-US",
      },
    ],
  };
}

export function createWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  };
}

export function createSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "macOS, Windows",
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    image: COMPANY.logoUrl,
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: TOOL_RATING.value,
      ratingCount: TOOL_RATING.count,
      bestRating: TOOL_RATING.best,
      worstRating: TOOL_RATING.worst,
    },
  };
}

export function createBlogPostingSchema({
  title,
  description,
  url,
  imageUrl,
  datePublished,
  dateModified,
  tags,
}: {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  datePublished: Date;
  dateModified?: Date;
  tags?: string[];
}) {
  const authorSameAs = BLOG_AUTHOR.linkedInUrl ? [BLOG_AUTHOR.linkedInUrl] : [];

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    headline: title,
    description,
    datePublished: datePublished.toISOString(),
    dateModified: (dateModified ?? datePublished).toISOString(),
    image: [imageUrl],
    keywords: tags?.join(", "),
    author: {
      "@type": "Person",
      name: BLOG_AUTHOR.name,
      url: BLOG_AUTHOR.url,
      sameAs: authorSameAs,
    },
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
  };
}

export function createBlogIndexSchema(
  posts: Array<{ name: string; url: string; datePublished: Date }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${SITE_URL}/blog#blog`,
    url: `${SITE_URL}/blog`,
    name: `${SITE_NAME} Journal`,
    description: "Product updates and practical guides for reliable keep-awake workflows.",
    publisher: {
      "@id": `${SITE_URL}/#organization`,
    },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      headline: post.name,
      url: post.url,
      datePublished: post.datePublished.toISOString(),
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    })),
  };
}
