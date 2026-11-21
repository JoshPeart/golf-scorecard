// GolfCore GET /v1/courses/st-andrews-old-course, trimmed to Black tees.
// Source: https://www.golfcore.org/courses/st-andrews-old-course/
const yards = [
  367, 400, 366, 413, 519, 368, 359, 170, 349, 341, 173, 309, 414, 527, 415,
  377, 449, 354,
];
const malePars = [4, 4, 4, 4, 5, 4, 4, 3, 4, 4, 3, 4, 4, 5, 4, 4, 4, 4];
const femalePars = [4, 5, 4, 5, 5, 4, 4, 3, 4, 4, 3, 4, 5, 5, 4, 4, 5, 4];
const maleSi = [11, 3, 7, 1, 13, 9, 5, 15, 17, 18, 6, 14, 2, 12, 8, 10, 4, 16];
const femaleSi = [
  11, 3, 7, 13, 1, 9, 5, 15, 17, 18, 16, 6, 2, 10, 8, 4, 14, 12,
];
const teeHoles = (pars: number[], si: number[]) =>
  pars.map((par, i) => ({
    position: i + 1,
    par,
    stroke_index: si[i],
    yards: yards[i],
  }));
export const golfcoreDetail = {
  slug: "st-andrews-old-course",
  name: "St Andrews Links - Old Course",
  url: "https://www.golfcore.org/courses/st-andrews-old-course/",
  city: "Saint Andrews",
  country: "gb",
  lat: 56.343564,
  lng: -2.802748,
  hole_count: 18,
  address: "St Andrews, Saint Andrews",
  layouts: [
    {
      name: "St. Andrews - Old Course",
      par: 72,
      yards: 6400,
      holes: Array.from({ length: 18 }, (_, i) => ({ position: i + 1 })),
      tees: [
        {
          name: "Black",
          gender: "M",
          yards: 6670,
          par: 72,
          rating: 73.4,
          slope: 136,
          holes: teeHoles(malePars, maleSi),
        },
        {
          name: "Black",
          gender: "F",
          yards: 6670,
          par: 76,
          rating: 79.8,
          slope: 148,
          holes: teeHoles(femalePars, femaleSi),
        },
      ],
    },
  ],
};

export const golfcoreSearch = {
  total: 1,
  count: 1,
  offset: 0,
  courses: [
    {
      slug: golfcoreDetail.slug,
      name: golfcoreDetail.name,
      city: "Saint Andrews",
      country: "gb",
      lat: golfcoreDetail.lat,
      lng: golfcoreDetail.lng,
      miles: 0,
    },
  ],
};

// GolfCourseAPI's published OpenAPI example values, not an authenticated capture.
// https://api.golfcourseapi.com/docs/api/openapi.yml
export const golfcourseapiDetail = {
  id: "7k2m9qb4",
  club_name: "Murray Golf Club",
  course_name: "Course No. 1",
  location: {
    address: "124 Golf Course Lane, Murray, KY 42071, USA",
    city: "Murray",
    state: "KY",
    country: "United States",
    latitude: 36.6103,
    longitude: -88.3148,
  },
  tees: {
    male: [
      {
        tee_name: "Blue",
        course_rating: 75.7,
        slope_rating: 132,
        total_yards: 6348,
        number_of_holes: 18,
        par_total: 73,
        holes: [
          { par: 4, yardage: 484, handicap: 9 },
          { par: 3, yardage: 189, handicap: 17 },
        ],
      },
    ],
    female: [],
  },
};
