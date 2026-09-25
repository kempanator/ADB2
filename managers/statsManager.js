class StatsManager {
  // Calculate statistics from current table data
  calculateStats() {
    const tableData = tableManager.model.getVisibleData();
    const stats = {
      total_songs: tableData.length,
      total_anime: 0,
      total_artists: 0,
      total_seasons: 0,
      average_difficulty: 0,
      average_length_seconds: 0,
      songs_by_type: {},
      songs_by_category: {},
      songs_by_anime_type: {},
      songs_by_broadcast: {},
      total_links: { HQ: 0, MQ: 0, audio: 0 },
      vintage_distribution: {},
      difficulty_distribution: {},
      difficulty_histogram: Array(10).fill(0),
      playable_content: { total: 0, with_hq: 0, with_mq: 0, with_audio: 0 },
      top_artists: [],
      top_anime: []
    };

    const animeSet = new Set();
    const artistSet = new Set();
    const seasonSet = new Set();
    const artistCounts = {};
    const animeCounts = {};
    let difficultySum = 0;
    let difficultyCount = 0;
    let lengthSum = 0;
    let lengthCount = 0;

    tableData.forEach(row => {
      // Song types
      const songType = this.categorizeSongType(row.songType);
      stats.songs_by_type[songType] = (stats.songs_by_type[songType] || 0) + 1;

    // Performance categories
    const category = row.songCategory || "No Performance";
      stats.songs_by_category[category] = (stats.songs_by_category[category] || 0) + 1;

      // Anime types
      const animeType = row.animeType || "Unknown";
      stats.songs_by_anime_type[animeType] = (stats.songs_by_anime_type[animeType] || 0) + 1;

      // Broadcast types
      const broadcastType = broadcastText(row);
      stats.songs_by_broadcast[broadcastType] = (stats.songs_by_broadcast[broadcastType] || 0) + 1;

      // Links
      if (row.HQ) stats.total_links.HQ++;
      if (row.MQ) stats.total_links.MQ++;
      if (row.audio) stats.total_links.audio++;

      // Playable content
      if (row.HQ || row.MQ || row.audio) {
        stats.playable_content.total++;
        if (row.HQ) stats.playable_content.with_hq++;
        if (row.MQ) stats.playable_content.with_mq++;
        if (row.audio) stats.playable_content.with_audio++;
      }

      // Vintage distribution
      const vintage = row.animeVintage || "Unknown";
      stats.vintage_distribution[vintage] = (stats.vintage_distribution[vintage] || 0) + 1;

      // Difficulty distribution
      const difficulty = this.categorizeDifficulty(row.songDifficulty);
      stats.difficulty_distribution[difficulty] = (stats.difficulty_distribution[difficulty] || 0) + 1;

      // Numeric difficulty histogram (1-100 in bins of 10). Exclude 0/null.
      const numDifRaw = optionalSongNumber(row.songDifficulty);
      if (numDifRaw !== null && numDifRaw > 0) {
        const clamped = Math.min(numDifRaw, 100);
        const binIndex = Math.min(9, Math.floor((clamped - 1) / 10));
        stats.difficulty_histogram[binIndex] = (stats.difficulty_histogram[binIndex] || 0) + 1;
        difficultySum += numDifRaw;
        difficultyCount++;
      }

      const length = optionalSongNumber(row.songLength);
      if (length !== null && length > 0) {
        lengthSum += length;
        lengthCount++;
      }

      // Unique counts
      const animeTitle = tableAnimeTitle(row, settingsManager.get("language")).trim() || "Unknown";
      const artist = row.songArtist.trim() || "Unknown";
      const season = row.animeVintage.trim() || "Unknown";

      if (animeTitle !== "Unknown") animeSet.add(animeTitle);
      if (artist !== "Unknown") artistSet.add(artist);
      if (season !== "Unknown") seasonSet.add(season);

      // Count for top lists
      artistCounts[artist] = (artistCounts[artist] || 0) + 1;
      animeCounts[animeTitle] = (animeCounts[animeTitle] || 0) + 1;
    });

    stats.average_difficulty = difficultyCount > 0 ? (difficultySum / difficultyCount) : 0;
    stats.average_length_seconds = lengthCount > 0 ? (lengthSum / lengthCount) : 0;

    stats.total_anime = animeSet.size;
    stats.total_artists = artistSet.size;
    stats.total_seasons = seasonSet.size;

    // Get top artists and anime
    stats.top_artists = Object.entries(artistCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([artist, count]) => ({ artist, count }));

    stats.top_anime = Object.entries(animeCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([anime, count]) => ({ anime, count }));

    return stats;
  }

  // Categorize song type into main categories
  categorizeSongType(songType) {
    if (!songType) return "Unknown";

    const s = String(songType).trim().toUpperCase();

    if (s.startsWith("OPENING") || s.startsWith("OP")) {
      return "Opening";
    }
    if (s.startsWith("ENDING") || s.startsWith("ED")) {
      return "Ending";
    }
    if (s.startsWith("INSERT") || s.startsWith("IN")) {
      return "Insert";
    }

    return "Unknown";
  }

  // Categorize difficulty into groups based on numeric value
  categorizeDifficulty(difficulty) {
    const num = optionalSongNumber(difficulty);
    if (num === null || num <= 0) return "Unknown";

    if (num >= 60) {
      return "Easy";
    } else if (num >= 25) {
      return "Medium";
    } else {
      return "Hard";
    }
  }

}

const statsManager = new StatsManager();
