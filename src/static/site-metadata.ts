interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const getBasePath = () => {
  const baseUrl = import.meta.env.BASE_URL;
  return baseUrl === '/' ? '' : baseUrl;
};

const data: ISiteMetadataResult = {
  siteTitle: 'Grant Running',
  siteUrl: 'https://kiddeke.github.io/running_page',
  logo: 'https://github.com/Kiddeke.png',
  description: 'Grant\'s running activities',
  navLinks: [
    {
      name: 'Summary',
      url: `${getBasePath()}/summary`,
    },
    {
      name: 'Strava',
      url: 'https://strava.app.link/gCkRdBePd4b',
    },
  ],
};

export default data;
