-- Two tidy-ups for the Spotify / YouTube split.
--
-- 1. The kinds of source live in one table that rooms and songs point at, instead of the same list repeated in a check
--    on each. A new source is one row here (plus its provider in the Edge Functions and src/lib/sources.ts).
-- 2. A song's duplicate key. A Spotify song is still one per title and first artist (remasters and live versions
--    included), but a video is its own key: two different videos can share a title and a channel ("Title (Official
--    Video)" and "Title (Lyrics)") and must not block each other, and nothing from one source can ever match another.

create table sources (id text primary key);
insert into sources (id) values ('spotify'), ('youtube');
-- nobody reads it through the API; only the foreign keys below use it
alter table sources enable row level security;

alter table rooms drop constraint rooms_source_check;
alter table rooms add constraint rooms_source_fkey foreign key (source) references sources (id);
alter table songs drop constraint songs_source_check;
alter table songs add constraint songs_source_fkey foreign key (source) references sources (id);

alter table songs drop constraint songs_room_id_song_key_key;
alter table songs drop column song_key;
alter table songs add column song_key text generated always as (
  case source
    when 'spotify' then
      coalesce(
        nullif(trim(regexp_replace(regexp_replace(lower(title), '\s*[(\[][^)\]]*[)\]]', '', 'g'), '\s+-\s+.*$', '')), ''),
        lower(title)
      ) || '|' || lower(split_part(artist, ', ', 1))
    else source || ':' || item_id
  end
) stored;
alter table songs add constraint songs_room_id_song_key_key unique (room_id, song_key);
