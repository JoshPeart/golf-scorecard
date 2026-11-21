// GolfCore GET /v1/courses/st-andrews-old-course, trimmed to two holes per tee.
// Source: https://www.golfcore.org/courses/st-andrews-old-course/
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
      holes: [
        { position: 1, par: 4, stroke_index: 11, yards: 352 },
        { position: 2, par: 4, stroke_index: 3, yards: 385 },
      ],
      tees: [
        {
          name: "Black",
          gender: "M",
          yards: 6670,
          par: 72,
          rating: 73.4,
          slope: 136,
          holes: [
            { position: 1, par: 4, stroke_index: 11, yards: 367 },
            { position: 2, par: 4, stroke_index: 3, yards: 400 },
          ],
        },
        {
          name: "Black",
          gender: "F",
          yards: 6670,
          par: 76,
          rating: 79.8,
          slope: 148,
          holes: [
            { position: 1, par: 4, stroke_index: 11, yards: 367 },
            { position: 2, par: 5, stroke_index: 3, yards: 400 },
          ],
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
