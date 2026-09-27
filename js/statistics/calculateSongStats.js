function calculateSongStats(tableData, language) {
  const stats = {
    total_songs: tableData.length,
    total_anime: 0,
    total_artists: 0,
    total_seasons: 0,
    average_difficulty: 0,
    average_length_seconds: 0,
    songs_by_type: Object.create(null),
    songs_by_category: Object.create(null),
    songs_by_anime_type: Object.create(null),
    songs_by_broadcast: Object.create(null),
    total_links: { HQ: 0, MQ: 0, audio: 0 },
    vintage_distribution: Object.create(null),
    difficulty_histogram: Array(10).fill(0),
    playable_content: { total: 0, with_hq: 0, with_mq: 0, with_audio: 0 },
    missing_data: { difficulty: 0, length: 0, season: 0 },
    top_artists: [],
    top_anime: []
  };

  const animeSet = new Set();
  const artistSet = new Set();
  const seasonSet = new Set();
  const artistCounts = Object.create(null);
  const animeCounts = Object.create(null);
  const artistIds = Object.create(null);
  const animeIds = Object.create(null);
  let difficultySum = 0;
  let difficultyCount = 0;
  let lengthSum = 0;
  let lengthCount = 0;

  tableData.forEach(row => {
    const songType = categorizeSongType(row.songType);
    stats.songs_by_type[songType] = (stats.songs_by_type[songType] || 0) + 1;

    const category = row.songCategory || "No Performance";
    stats.songs_by_category[category] = (stats.songs_by_category[category] || 0) + 1;

    const animeType = row.animeType || "Unknown";
    stats.songs_by_anime_type[animeType] = (stats.songs_by_anime_type[animeType] || 0) + 1;

    const broadcastType = broadcastText(row);
    stats.songs_by_broadcast[broadcastType] = (stats.songs_by_broadcast[broadcastType] || 0) + 1;

    if (row.HQ) stats.total_links.HQ++;
    if (row.MQ) stats.total_links.MQ++;
    if (row.audio) stats.total_links.audio++;

    if (row.HQ || row.MQ || row.audio) {
      stats.playable_content.total++;
      if (row.HQ) stats.playable_content.with_hq++;
      if (row.MQ) stats.playable_content.with_mq++;
      if (row.audio) stats.playable_content.with_audio++;
    }

    const vintage = row.animeVintage || "Unknown";
    stats.vintage_distribution[vintage] = (stats.vintage_distribution[vintage] || 0) + 1;
    if (!row.animeVintage.trim()) stats.missing_data.season++;

    // Numeric difficulty histogram (1-100 in bins of 10). Exclude 0/null.
    const numDifRaw = optionalSongNumber(row.songDifficulty);
    if (numDifRaw !== null && numDifRaw > 0) {
      const clamped = Math.min(numDifRaw, 100);
      const binIndex = Math.max(0, Math.min(9, Math.ceil(clamped / 10) - 1));
      stats.difficulty_histogram[binIndex] = (stats.difficulty_histogram[binIndex] || 0) + 1;
      difficultySum += numDifRaw;
      difficultyCount++;
    } else if (numDifRaw === null) stats.missing_data.difficulty++;

    const length = optionalSongNumber(row.songLength);
    if (length !== null && length > 0) {
      lengthSum += length;
      lengthCount++;
    } else if (length === null) stats.missing_data.length++;

    const animeTitle = songAnimeTitle(row, language).trim() || "Unknown";
    const artist = row.songArtist.trim() || "Unknown";
    const season = row.animeVintage.trim() || "Unknown";

    if (animeTitle !== "Unknown") animeSet.add(animeTitle);
    if (artist !== "Unknown") artistSet.add(artist);
    if (season !== "Unknown") seasonSet.add(season);

    artistCounts[artist] = (artistCounts[artist] || 0) + 1;
    animeCounts[animeTitle] = (animeCounts[animeTitle] || 0) + 1;
    if (animeTitle !== "Unknown") {
      const id = optionalSongNumber(row.annId);
      if (Number.isSafeInteger(id) && id > 0) (animeIds[animeTitle] ||= new Set()).add(id);
    }
    if (artist !== "Unknown") {
      for (const credited of Array.isArray(row.artists) ? row.artists : []) {
        const id = optionalSongNumber(credited?.id);
        if (Number.isSafeInteger(id) && id > 0) (artistIds[artist] ||= new Set()).add(id);
      }
    }
  });

  stats.average_difficulty = difficultyCount > 0 ? (difficultySum / difficultyCount) : 0;
  stats.average_length_seconds = lengthCount > 0 ? (lengthSum / lengthCount) : 0;

  stats.total_anime = animeSet.size;
  stats.total_artists = artistSet.size;
  stats.total_seasons = seasonSet.size;

  stats.top_artists = Object.entries(artistCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([artist, count]) => ({ artist, count, ids: [...(artistIds[artist] || [])].sort((a, b) => a - b) }));

  stats.top_anime = Object.entries(animeCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([anime, count]) => ({ anime, count, ids: [...(animeIds[anime] || [])].sort((a, b) => a - b) }));

  return stats;
}

function categorizeSongType(songType) {
  return { opening: "Opening", ending: "Ending", insert: "Insert", other: "Unknown" }[parseSongType(songType).category];
}
