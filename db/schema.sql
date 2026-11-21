-- The app currently persists the same model in localStorage; no hosted database is required.
create table if not exists courses (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  club_name text,
  address text,
  postcode text,
  lat double precision,
  lng double precision,
  country text,
  source text check (source in ('golfcore', 'golfcourseapi', 'manual')),
  source_id text,
  source_url text,
  last_synced_at timestamptz,
  verified boolean,
  customised boolean,
  favourite boolean,
  hole_count integer not null check (hole_count in (9, 18)),
  unique (source, source_id)
);
create table if not exists tees (
  id text primary key default gen_random_uuid()::text,
  course_id text not null references courses(id) on delete cascade,
  name text not null,
  colour text,
  gender text check (gender in ('male', 'female', 'mixed')),
  course_rating double precision,
  slope integer,
  total_yardage integer
);
create table if not exists holes (
  id text primary key default gen_random_uuid()::text,
  course_id text not null references courses(id) on delete cascade,
  hole_number integer not null check (hole_number > 0),
  stroke_index integer,
  unique (course_id, hole_number)
);
create table if not exists tee_holes (
  id text primary key default gen_random_uuid()::text,
  tee_id text not null references tees(id) on delete cascade,
  hole_number integer not null check (hole_number > 0),
  par integer,
  yardage integer,
  stroke_index integer,
  unique (tee_id, hole_number)
);
