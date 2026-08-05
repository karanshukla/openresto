-- Paddy's Pub config snapshot — restored by purge-bookings.sh every 2 hours.
-- Edit this file to update what gets restored. Do NOT add Bookings/PII here.
PRAGMA foreign_keys = OFF;

DELETE FROM Highlights;

DELETE FROM SocialLinks;

DELETE FROM TableGroupMemberships;

DELETE FROM TableGroups;

DELETE FROM Tables;

DELETE FROM Sections;

DELETE FROM Restaurants;

DELETE FROM BrandSettings;

DELETE FROM EmailSettings;

DELETE FROM sqlite_sequence
WHERE
  name IN (
    'Highlights',
    'SocialLinks',
    'TableGroups',
    'Tables',
    'Sections',
    'Restaurants',
    'BrandSettings',
    'EmailSettings'
  );

-- Brand
-- HeaderImageFit left NULL → defaults to Cover (today's behaviour).
INSERT INTO
  BrandSettings (
    Id,
    AppName,
    PrimaryColor,
    AccentColor,
    HeaderImageUrl,
    FaviconIcon,
    WebsiteUrl,
    PhoneNumber,
    EmailAddress,
    CopyrightText,
    Subtitle,
    HighlightsHeading,
    HighlightsSubheading
  )
VALUES
  (
    1,
    'Paddy''s Pub',
    '#059669',
    NULL,
    '/media/hero.jpg?v=1780749336371',
    'pizza',
    'https://openres.to',
    '+1 215 555 0100',
    'bookings@paddyspub.example',
    NULL,
    'Philadelphia''s home of milk steak and jelly beans.',
    'What we''re known for',
    'Curated by Frank Reynolds'
  );

-- Social Links (footer)
INSERT INTO
  SocialLinks (Id, Label, Url, IconKey, SortOrder)
VALUES
  (1, 'Instagram', 'https://instagram.com/paddyspub', 'logo-instagram', 0);

INSERT INTO
  SocialLinks (Id, Label, Url, IconKey, SortOrder)
VALUES
  (2, 'Yelp', 'https://yelp.com/biz/paddys-pub', 'star-outline', 1);

-- Email settings intentionally left empty (no credentials in source control)
-- Restaurants
-- DefaultBookingDurationMinutes defaults to 60 (NOT NULL, added by migration).
-- BookingSlotIntervalMinutes defaults to 30 (NOT NULL, added by migration) — the step
--   between selectable start times, decoupled from the booking duration above.
-- OpenHoursJson is NULL so OpenTime/CloseTime apply to every day.
-- WalkInOnly is 0 and WalkInDays is NULL so online bookings stay enabled.
-- Description supports [label](url) inline links — see app/(user)/restaurant/[id].tsx.
-- PhoneNumber/EmailAddress are the per-location contact override: 1 sets both, 2 sets neither
--   (falls back to the BrandSettings pair above), 3 sets only a phone (its email still falls
--   back) — the three states the large-party modal has to handle.
INSERT INTO
  Restaurants (
    Id,
    Name,
    Address,
    OpenTime,
    CloseTime,
    OpenDays,
    Timezone,
    BookingsPausedUntil,
    Tags,
    ImageUrl,
    IsArchived,
    DefaultBookingDurationMinutes,
    BookingSlotIntervalMinutes,
    OpenHoursJson,
    WalkInOnly,
    WalkInDays,
    Description,
    MenuUrl,
    PhoneNumber,
    EmailAddress
  )
VALUES
  (
    1,
    'Paddy''s Pub',
    '346 W Girard Ave, Philadelphia, PA',
    '09:00',
    '23:45',
    '1,2,3,4,5,6',
    'America/Toronto',
    NULL,
    'mac and cheese,fight milk',
    '/media/location-1.jpg?v=1779668717048',
    0,
    60,
    30,
    NULL,
    0,
    NULL,
    'Philadelphia''s worst bar, now taking bookings. See our [menu](https://paddyspub.example/menu) — cash only.',
    'https://paddyspub.example/menu',
    '+1 215 555 0123',
    'philly@paddyspub.example'
  );

INSERT INTO
  Restaurants (
    Id,
    Name,
    Address,
    OpenTime,
    CloseTime,
    OpenDays,
    Timezone,
    BookingsPausedUntil,
    Tags,
    ImageUrl,
    IsArchived,
    DefaultBookingDurationMinutes,
    BookingSlotIntervalMinutes,
    OpenHoursJson,
    WalkInOnly,
    WalkInDays,
    Description,
    MenuUrl,
    PhoneNumber,
    EmailAddress
  )
VALUES
  (
    2,
    'Paddy''s Pub Toronto',
    'The Alley Behind the Alley, Toronto, ON',
    '09:00',
    '23:45',
    '3,4,5,6',
    'America/Toronto',
    NULL,
    'charlie work,mantis toboggan',
    '/media/location-2.webp',
    0,
    60,
    30,
    NULL,
    0,
    NULL,
    'The Alley Behind the Alley. Walk-ins welcome, online bookings for the brave.',
    NULL,
    NULL,
    NULL
  );

INSERT INTO
  Restaurants (
    Id,
    Name,
    Address,
    OpenTime,
    CloseTime,
    OpenDays,
    Timezone,
    BookingsPausedUntil,
    Tags,
    ImageUrl,
    IsArchived,
    DefaultBookingDurationMinutes,
    BookingSlotIntervalMinutes,
    OpenHoursJson,
    WalkInOnly,
    WalkInDays,
    Description,
    MenuUrl,
    PhoneNumber,
    EmailAddress
  )
VALUES
  (
    3,
    'Paddy''s Pub (Vancouver)',
    'Multiple Areas, please don''t ask',
    '00:00',
    '23:00',
    '1,2,3,4,5,6,7',
    'America/Los_Angeles',
    '2026-06-01 14:24:27.6555714',
    'wolf cola,dennis system',
    '/media/location-3.jpg?v=1780155462249',
    0,
    60,
    30,
    NULL,
    0,
    NULL,
    'Open 24 hours because we lost the keys to the lock. [Reviews](https://paddyspub.example/reviews).',
    'https://paddyspub.example/vancouver-menu.pdf',
    '+1 604 555 0177',
    NULL
  );

-- Sections
INSERT INTO
  Sections (Id, Name, RestaurantId, SortOrder)
VALUES
  (1, 'Indoor', 1, 0);

INSERT INTO
  Sections (Id, Name, RestaurantId, SortOrder)
VALUES
  (2, 'Patio', 1, 1);

INSERT INTO
  Sections (Id, Name, RestaurantId, SortOrder)
VALUES
  (3, 'Bar', 2, 0);

INSERT INTO
  Sections (Id, Name, RestaurantId, SortOrder)
VALUES
  (4, 'The Bar', 3, 0);

INSERT INTO
  Sections (Id, Name, RestaurantId, SortOrder)
VALUES
  (5, 'Tables', 2, 1);

-- Tables
INSERT INTO
  Tables (Id, Name, Seats, SectionId)
VALUES
  (1, 'T1', 4, 1);

INSERT INTO
  Tables (Id, Name, Seats, SectionId)
VALUES
  (2, 'T2', 2, 1);

INSERT INTO
  Tables (Id, Name, Seats, SectionId)
VALUES
  (3, 'P1', 4, 2);

INSERT INTO
  Tables (Id, Name, Seats, SectionId)
VALUES
  (4, 'B1', 2, 3);

INSERT INTO
  Tables (Id, Name, Seats, SectionId)
VALUES
  (5, 'B2', 2, 3);

INSERT INTO
  Tables (Id, Name, Seats, SectionId)
VALUES
  (6, 'Bar Table', 2, 4);

INSERT INTO
  Tables (Id, Name, Seats, SectionId)
VALUES
  (7, 'B3', 1, 3);

INSERT INTO
  Tables (Id, Name, Seats, SectionId)
VALUES
  (8, 'Table 1', 4, 5);

-- Combinable table groups — physical tables an admin flagged as pushable together, bookable as
-- one unit for a larger party. CombinedSeats must sit in (largest member seats, sum of members]:
-- group 1 loses a cover where the corners meet (4+2 tables seating 5), group 2 keeps all four.
-- Member tables stay individually bookable; grouping only deprioritizes them in auto-assign.
INSERT INTO
  TableGroups (Id, Name, RestaurantId, CombinedSeats)
VALUES
  (1, 'Window booths', 1, 5);

INSERT INTO
  TableGroupMemberships (TableGroupId, TableId)
VALUES
  (1, 1);

INSERT INTO
  TableGroupMemberships (TableGroupId, TableId)
VALUES
  (1, 2);

INSERT INTO
  TableGroups (Id, Name, RestaurantId, CombinedSeats)
VALUES
  (2, NULL, 2, 4);

INSERT INTO
  TableGroupMemberships (TableGroupId, TableId)
VALUES
  (2, 4);

INSERT INTO
  TableGroupMemberships (TableGroupId, TableId)
VALUES
  (2, 5);

-- Highlights (Link=NULL → static card; set a Link to make the whole card clickable)
INSERT INTO
  Highlights (Id, Title, Body, IconKey, SortOrder, Link)
VALUES
  (
    1,
    'Dayman Live Every Friday',
    'Fighter of the Nightman. No cover charge. Cash only. Residency secured after a lengthy legal dispute.',
    'star-outline',
    0,
    'https://paddyspub.example/dayman'
  );

INSERT INTO
  Highlights (Id, Title, Body, IconKey, SortOrder, Link)
VALUES
  (
    2,
    'Frank''s Famous Rum Ham',
    'A Reynolds family tradition since 1981. Seasonal availability. Do not ask about the ingredients. Do not ask where Frank has been.',
    'pizza-outline',
    1,
    NULL
  );

INSERT INTO
  Highlights (Id, Title, Body, IconKey, SortOrder, Link)
VALUES
  (
    3,
    'Chardee MacDennis',
    'The Game of Games. Teams of 2. Bring your own wine glass to smash. Management not responsible for emotional damage.',
    'gift-outline',
    2,
    NULL
  );

INSERT INTO
  Highlights (Id, Title, Body, IconKey, SortOrder, Link)
VALUES
  (
    4,
    'Milk Steak - Our Signature Dish',
    'Boiled over hard, served with a side of your finest jelly beans. Charlie''s personal recipe. Our most polarising menu item. Loved by ghouls.',
    'nutrition-outline',
    3,
    'https://paddyspub.example/menu'
  );

PRAGMA foreign_keys = ON;