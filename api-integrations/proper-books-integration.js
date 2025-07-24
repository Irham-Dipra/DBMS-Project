#!/usr/bin/env node

const path = require('path');
require(path.join(__dirname, '..', 'backend', 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', 'backend', '.env') });
const { Pool } = require(path.join(__dirname, '..', 'backend', 'node_modules', 'pg'));
const https = require('https');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'dipra3223',
  database: process.env.DB_NAME || 'litloom',
  port: process.env.DB_PORT || 5432,
});

// Hardcover API configuration
const HARDCOVER_API_URL = 'https://api.hardcover.app/v1/graphql';
const HARDCOVER_API_KEY = process.env.HARDCOVER_API_KEY;

// Language data will be dynamically fetched from the API through edition objects

function makeGraphQLRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      query: query,
      variables: variables
    });

    const options = {
      hostname: 'api.hardcover.app',
      port: 443,
      path: '/v1/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HARDCOVER_API_KEY}`,
        'User-Agent': 'LitLoom-Integration/1.0',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (response.errors) {
            reject(new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`));
          } else {
            resolve(response.data);
          }
        } catch (error) {
          reject(new Error(`Failed to parse JSON: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Query to get books directly from the books table with genre and character data
const BOOKS_QUERY = `
  query GetBooks($startId: Int!, $limit: Int!) {
    books(where: {id: {_gte: $startId}}, limit: $limit, order_by: {id: asc}) {
      id
      title
      description
      pages
      rating
      users_count
      cached_tags
      image {
        url
      }
      contributions {
        author {
          id
          name
          bio
          slug
          image {
            url
          }
        }
        contribution
      }
      book_characters {
        character {
          id
          name
          biography
        }
      }
      editions {
        id
        title
        pages
        release_date
        isbn_10
        isbn_13
        publisher_id
        language_id
        country_id
        users_count
        country {
          id
          name
        }
        language {
          id
          language
        }
        image {
          url
        }
      }
    }
  }
`;

const PUBLISHER_QUERY = `
  query GetPublisher($id: bigint!) {
    publishers(where: {id: {_eq: $id}}, limit: 1) {
      id
      name
    }
  }
`;

// Helper functions - Language data now comes from edition objects directly

async function getPublisherFromAPI(publisherId) {
  try {
    const result = await makeGraphQLRequest(PUBLISHER_QUERY, { id: publisherId });
    if (result.publishers && result.publishers.length > 0) {
      return {
        name: result.publishers[0].name,
        country: null // Country not available in API
      };
    }
    return null;
  } catch (error) {
    console.log(`Could not fetch publisher for ID ${publisherId}: ${error.message}`);
    return null;
  }
}

// Database helper functions
async function getOrCreateLanguage(client, languageName) {
  if (!languageName) return null;
  
  const existingLanguage = await client.query(
    'SELECT id FROM languages WHERE name = $1',
    [languageName]
  );
  
  if (existingLanguage.rows.length > 0) {
    return existingLanguage.rows[0].id;
  }
  
  const newLanguage = await client.query(
    'INSERT INTO languages (name, iso_code) VALUES ($1, $2) RETURNING id',
    [languageName, languageName.toLowerCase().substring(0, 10)]
  );
  
  return newLanguage.rows[0].id;
}

async function getOrCreatePublisher(client, publisherName) {
  if (!publisherName) return null;
  
  const existingPublisher = await client.query(
    'SELECT id FROM publication_houses WHERE name = $1',
    [publisherName]
  );
  
  if (existingPublisher.rows.length > 0) {
    return existingPublisher.rows[0].id;
  }
  
  const newPublisher = await client.query(
    'INSERT INTO publication_houses (name) VALUES ($1) RETURNING id',
    [publisherName]
  );
  
  return newPublisher.rows[0].id;
}

async function getOrCreateAuthor(client, authorData) {
  if (!authorData || !authorData.name) return null;
  
  const existingAuthor = await client.query(
    'SELECT id FROM authors WHERE name = $1',
    [authorData.name]
  );
  
  // Helper function to validate if image URL is actually an author image
  const isValidAuthorImage = (imageUrl) => {
    if (!imageUrl) return false;
    // Only accept URLs that contain '/author' or '/authors/' - reject book cover URLs
    return imageUrl.includes('/author') && !imageUrl.includes('/books/');
  };
  
  // Get validated author image URL
  const validAuthorImageUrl = (authorData.image?.url && isValidAuthorImage(authorData.image.url)) 
    ? authorData.image.url 
    : null;
  
  if (existingAuthor.rows.length > 0) {
    const authorId = existingAuthor.rows[0].id;
    
    // Update existing author with valid image if not already present
    if (validAuthorImageUrl) {
      await client.query(
        'UPDATE authors SET author_image = $1 WHERE id = $2 AND author_image IS NULL',
        [validAuthorImageUrl, authorId]
      );
      console.log(`    ✓ Updated author image for: ${authorData.name}`);
    } else if (authorData.image?.url) {
      console.log(`    ⚠️ Rejected invalid author image (book cover): ${authorData.name} - ${authorData.image.url}`);
    }
    
    return authorId;
  }
  
  // Insert author with available data (bio and validated image can be null)
  const newAuthor = await client.query(
    'INSERT INTO authors (name, bio, author_image) VALUES ($1, $2, $3) RETURNING id',
    [
      authorData.name,
      authorData.bio || null,
      validAuthorImageUrl
    ]
  );
  
  if (authorData.image?.url && !validAuthorImageUrl) {
    console.log(`    ⚠️ Rejected invalid author image (book cover): ${authorData.name} - ${authorData.image.url}`);
  }
  
  console.log(`    ✓ Created author: ${authorData.name} (ID: ${newAuthor.rows[0].id}) - bio=${!!authorData.bio}, image=${!!validAuthorImageUrl}`);
  return newAuthor.rows[0].id;
}

// NEW: Genre handling functions
async function getOrCreateGenre(client, genreName) {
  if (!genreName) return null;
  
  const existingGenre = await client.query(
    'SELECT id FROM genres WHERE name = $1',
    [genreName]
  );
  
  if (existingGenre.rows.length > 0) {
    return existingGenre.rows[0].id;
  }
  
  const newGenre = await client.query(
    'INSERT INTO genres (name) VALUES ($1) RETURNING id',
    [genreName]
  );
  
  console.log(`    ✓ Created genre: ${genreName} (ID: ${newGenre.rows[0].id})`);
  return newGenre.rows[0].id;
}

// NEW: Character handling functions
async function getOrCreateCharacter(client, characterData) {
  if (!characterData || !characterData.name) return null;
  
  const existingCharacter = await client.query(
    'SELECT id FROM characters WHERE name = $1',
    [characterData.name]
  );
  
  if (existingCharacter.rows.length > 0) {
    return existingCharacter.rows[0].id;
  }
  
  const newCharacter = await client.query(
    'INSERT INTO characters (name, biography) VALUES ($1, $2) RETURNING id',
    [characterData.name, characterData.biography || null]
  );
  
  console.log(`    ✓ Created character: ${characterData.name} (ID: ${newCharacter.rows[0].id})`);
  return newCharacter.rows[0].id;
}

async function processGenreData(client, bookId, cachedTags) {
  if (!cachedTags || typeof cachedTags !== 'object') {
    return;
  }
  
  // Extract genres from cached_tags
  const genres = cachedTags.Genre || [];
  
  if (genres.length > 0) {
    console.log(`    🎭 Processing ${genres.length} genres...`);
    
    for (const genre of genres) {
      try {
        const genreId = await getOrCreateGenre(client, genre.tag);
        if (genreId) {
          // Insert book-genre relationship
          await client.query(
            'INSERT INTO book_genres (book_id, genre_id) VALUES ($1, $2) ON CONFLICT (book_id, genre_id) DO NOTHING',
            [bookId, genreId]
          );
          console.log(`      ✓ Linked genre: ${genre.tag} (Count: ${genre.count})`);
        }
      } catch (error) {
        console.log(`      ✗ Error processing genre ${genre.tag}: ${error.message}`);
      }
    }
  } else {
    console.log(`    ℹ️ No genres found in cached_tags`);
  }
}

async function processCharacterData(client, bookId, bookCharacters) {
  if (!bookCharacters || bookCharacters.length === 0) {
    console.log(`    ℹ️ No characters found for this book`);
    return;
  }
  
  console.log(`    👥 Processing ${bookCharacters.length} characters...`);
  
  for (const bookCharacter of bookCharacters) {
    try {
      if (bookCharacter.character) {
        const characterId = await getOrCreateCharacter(client, bookCharacter.character);
        if (characterId) {
          // Insert book-character relationship
          await client.query(
            'INSERT INTO book_character_appearances (book_id, character_id) VALUES ($1, $2) ON CONFLICT (book_id, character_id) DO NOTHING',
            [bookId, characterId]
          );
          console.log(`      ✓ Linked character: ${bookCharacter.character.name}`);
        }
      }
    } catch (error) {
      console.log(`      ✗ Error processing character ${bookCharacter.character?.name || 'unknown'}: ${error.message}`);
    }
  }
}

function selectBestEdition(editions) {
  if (!editions || editions.length === 0) return null;
  
  // New Priority Logic:
  // 1. FIRST: Sort by reader count (users_count) - most popular editions
  // 2. SECOND: Consider data completeness as tiebreaker
  // 3. THIRD: Sort by release date as final tiebreaker
  
  console.log(`    Selecting from ${editions.length} editions...`);
  
  // Sort by multiple criteria with reader count as primary
  const sortedEditions = editions.sort((a, b) => {
    // Primary: Reader count (higher is better)
    const aReaders = a.users_count || 0;
    const bReaders = b.users_count || 0;
    if (aReaders !== bReaders) {
      return bReaders - aReaders; // Descending order
    }
    
    // Secondary: Data completeness score
    const getDataScore = (edition) => {
      let score = 0;
      if (edition.publisher_id) score += 3;
      if (edition.language_id) score += 3;
      if (edition.country_id) score += 2;
      if (edition.isbn_13 || edition.isbn_10) score += 1;
      if (edition.pages) score += 1;
      return score;
    };
    
    const aScore = getDataScore(a);
    const bScore = getDataScore(b);
    if (aScore !== bScore) {
      return bScore - aScore; // Higher score is better
    }
    
    // Tertiary: Release date (newer is better)
    if (a.release_date && b.release_date) {
      return new Date(b.release_date) - new Date(a.release_date);
    }
    if (a.release_date && !b.release_date) return -1;
    if (!a.release_date && b.release_date) return 1;
    
    return 0;
  });
  
  const selectedEdition = sortedEditions[0];
  
  console.log(`    Selected edition: ID ${selectedEdition.id}`);
  console.log(`      Readers: ${selectedEdition.users_count || 0}`);
  console.log(`      Data: Publisher=${!!selectedEdition.publisher_id}, Language=${!!selectedEdition.language_id}, Country=${!!selectedEdition.country_id}`);
  console.log(`      Release Date: ${selectedEdition.release_date || 'Unknown'}`);
  
  return selectedEdition;
}

async function insertBook(client, bookData, userId = 1) {
  // Check if book already exists
  const existingBook = await client.query(
    'SELECT id FROM books WHERE title = $1',
    [bookData.title]
  );
  
  if (existingBook.rows.length > 0) {
    console.log(`Book "${bookData.title}" already exists, skipping...`);
    return existingBook.rows[0].id;
  }
  
  console.log(`Processing book: "${bookData.title}" (API ID: ${bookData.id})`);
  console.log(`  Available editions: ${bookData.editions ? bookData.editions.length : 0}`);
  
  // Initialize all fields with books table data as primary source
  let title = bookData.title;
  let description = bookData.description || null;
  let pages = bookData.pages || null;
  let rating = bookData.rating || 0;
  let usersCount = bookData.users_count || 0;
  let coverImageUrl = null;
  
  // Fields that MUST be populated from editions table
  let languageId = null;
  let publisherId = null;
  let publicationDate = null;
  let isbn = null;
  let originalCountry = null;
  
  // Get cover image from books table first
  if (bookData.image && bookData.image.url) {
    coverImageUrl = bookData.image.url;
    console.log(`  ✓ Using main book cover image`);
  }
  
  // NEW COMPREHENSIVE DATA COLLECTION: Loop through ALL editions
  if (bookData.editions && bookData.editions.length > 0) {
    console.log(`  🔍 Collecting data from ${bookData.editions.length} editions...`);
    
    for (let i = 0; i < bookData.editions.length; i++) {
      const edition = bookData.editions[i];
      console.log(`    📖 Edition ${i + 1} (ID: ${edition.id}):`);
      
      // Collect pages if not found yet
      if (!pages && edition.pages) {
        pages = edition.pages;
        console.log(`      ✓ Found pages: ${pages}`);
      }
      
      // Collect users count (use highest)
      if (edition.users_count && edition.users_count > usersCount) {
        usersCount = edition.users_count;
        console.log(`      ✓ Found higher users count: ${usersCount}`);
      }
      
      // Collect cover image if not found yet
      if (!coverImageUrl && edition.image && edition.image.url) {
        coverImageUrl = edition.image.url;
        console.log(`      ✓ Found cover image`);
      }
      
      // Collect language if not found yet
      if (!languageId && edition.language && edition.language.language) {
        const languageName = edition.language.language;
        languageId = await getOrCreateLanguage(client, languageName);
        console.log(`      ✓ Found language: ${languageName} (ID: ${languageId})`);
      }
      
      // Collect publisher if not found yet
      if (!publisherId && edition.publisher_id) {
        const publisherInfo = await getPublisherFromAPI(edition.publisher_id);
        if (publisherInfo) {
          publisherId = await getOrCreatePublisher(client, publisherInfo.name);
          console.log(`      ✓ Found publisher: ${publisherInfo.name} (ID: ${publisherId})`);
        }
      }
      
      // Collect country if not found yet
      if (!originalCountry && edition.country && edition.country.name) {
        originalCountry = edition.country.name;
        console.log(`      ✓ Found country: ${originalCountry}`);
      }
      
      // Collect publication date if not found yet (prefer earliest date)
      if (!publicationDate && edition.release_date) {
        publicationDate = edition.release_date;
        console.log(`      ✓ Found publication date: ${publicationDate}`);
      } else if (publicationDate && edition.release_date) {
        // Keep the earlier date
        if (new Date(edition.release_date) < new Date(publicationDate)) {
          publicationDate = edition.release_date;
          console.log(`      ✓ Found earlier publication date: ${publicationDate}`);
        }
      }
      
      // Collect ISBN if not found yet (prefer ISBN-13)
      if (!isbn && (edition.isbn_13 || edition.isbn_10)) {
        isbn = edition.isbn_13 || edition.isbn_10;
        console.log(`      ✓ Found ISBN: ${isbn}`);
      }
      
      // Rate limiting between edition API calls
      if (i < bookData.editions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // CHECK IF ALL REQUIRED FIELDS ARE PRESENT - NO OPTIONAL FIELDS
    const missingFields = [];
    
    // ALL fields are required for insertion
    if (!description) missingFields.push('description');
    if (!languageId) missingFields.push('language');
    if (!publisherId) missingFields.push('publisher');
    if (!originalCountry) missingFields.push('country');
    if (!publicationDate) missingFields.push('publication_date');
    if (!isbn) missingFields.push('isbn');
    if (!coverImageUrl) missingFields.push('cover_image');
    if (!pages) missingFields.push('pages');
    
    // Skip book if ANY data is missing
    if (missingFields.length > 0) {
      console.log(`  ❌ SKIPPING BOOK: Missing required fields: ${missingFields.join(', ')}`);
      console.log(`  📊 Data completeness: ${((8 - missingFields.length) / 8 * 100).toFixed(1)}%`);
      return null; // Return null to indicate book was skipped
    }
    
    console.log(`  ✅ ALL FIELDS FOUND! Data completeness: 100%`);
    console.log(`  📋 Complete record: Title, Description, Cover, ISBN, Language, Publisher, Country, Date, Pages`);
    
  } else {
    console.log(`  ❌ SKIPPING BOOK: No editions available`);
    return null;
  }
  
  // Insert the book with integrated data from both sources
  const newBook = await client.query(`
    INSERT INTO books (
      title, description, publication_date, cover_image, original_country,
      language_id, publication_house_id, average_rating, 
      isbn, readers_count, page, added_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id
  `, [
    title,
    description,
    publicationDate,
    coverImageUrl,
    originalCountry,
    languageId,
    publisherId,
    rating,
    isbn,
    usersCount,
    pages,
    userId
  ]);
  
  const bookId = newBook.rows[0].id;
  
  // Insert book-author relationships
  if (bookData.contributions && bookData.contributions.length > 0) {
    for (const contribution of bookData.contributions) {
      if (contribution.author) {
        const authorId = await getOrCreateAuthor(client, contribution.author);
        if (authorId) {
          await client.query(
            'INSERT INTO book_authors (book_id, author_id) VALUES ($1, $2) ON CONFLICT (book_id, author_id) DO NOTHING',
            [bookId, authorId]
          );
        }
      }
    }
  }
  
  // NEW: Process genre data from cached_tags
  if (bookData.cached_tags) {
    await processGenreData(client, bookId, bookData.cached_tags);
  }
  
  // NEW: Process character data from book_characters
  if (bookData.book_characters) {
    await processCharacterData(client, bookId, bookData.book_characters);
  }
  
  console.log(`  ✅ Inserted: "${title}" (DB ID: ${bookId})`);
  console.log(`     Description: ${description ? 'HAS DATA' : 'NULL'}`);
  console.log(`     Cover Image: ${coverImageUrl ? 'SET' : 'NULL'}`);
  console.log(`     Publication Date: ${publicationDate ? 'SET' : 'NULL'}`);
  console.log(`     Country: ${originalCountry || 'NULL'}`);
  console.log(`     Language: ${languageId ? 'SET' : 'NULL'}`);
  console.log(`     Publisher: ${publisherId ? 'SET' : 'NULL'}`);
  console.log(`     Rating: ${rating || 'NULL'}`);
  console.log(`     ISBN: ${isbn || 'NULL'}`);
  console.log(`     Users Count: ${usersCount || 'NULL'}`);
  console.log(`     Pages: ${pages || 'NULL'}`);
  
  return bookId;
}

async function importBooksDirectly(startId = 100000, batchSize = 50, maxBooks = 100) {
  const client = await pool.connect();
  
  try {
    console.log('=== Direct Books Import from Hardcover API ===\n');
    console.log(`Starting from book ID: ${startId}`);
    console.log(`Batch size: ${batchSize}, Max books: ${maxBooks}\n`);
    
    let currentId = startId;
    let totalProcessed = 0;
    let totalInserted = 0;
    let totalSkipped = 0;
    
    while (totalProcessed < maxBooks) {
      console.log(`\n--- Fetching batch starting from ID ${currentId} ---`);
      
      try {
        const booksData = await makeGraphQLRequest(BOOKS_QUERY, {
          startId: currentId,
          limit: batchSize
        });
        
        
        if (!booksData || !booksData.books || booksData.books.length === 0) {
          console.log('No more books found, ending import.');
          break;
        }
        
        console.log(`Retrieved ${booksData.books.length} books from API`);
        
        for (const book of booksData.books) {
          try {
            const bookId = await insertBook(client, book);
            if (bookId) {
              totalInserted++;
            } else {
              totalSkipped++;
            }
            totalProcessed++;
            
            if (totalProcessed >= maxBooks) break;
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error(`Error processing book ${book.title}:`, error.message);
            totalSkipped++;
          }
          
          // Update currentId for next batch
          currentId = Math.max(currentId, book.id + 1);
        }
        
      } catch (error) {
        console.error('Error in API request:', error.message);
        break;
      }
    }
    
    console.log(`\n✅ Import completed!`);
    console.log(`Total books processed: ${totalProcessed}`);
    console.log(`Total books inserted: ${totalInserted}`);
    console.log(`Total books skipped: ${totalSkipped}`);
    console.log(`Success rate: ${totalProcessed > 0 ? ((totalInserted / totalProcessed) * 100).toFixed(1) : 0}%`);
    
  } catch (error) {
    console.error('Error during import:', error.message);
  } finally {
    client.release();
  }
}

// Main function
async function main() {
  console.log('=== Proper Hardcover Books Integration ===\n');
  
  const args = process.argv.slice(2);
  const startId = parseInt(args[0]) || 100000;
  const maxBooks = parseInt(args[1]) || 20;
  
  try {
    await importBooksDirectly(startId, 50, maxBooks);
  } catch (error) {
    console.error('Fatal error:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}