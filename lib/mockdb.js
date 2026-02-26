// Mock MongoDB for local development
// Stores data in memory and persists to JSON file

const fs = require('fs');
const path = require('path');

const dbFile = path.join(process.cwd(), '.mockdb.json');

class MockDB {
  constructor() {
    this.data = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(dbFile)) {
        const content = fs.readFileSync(dbFile, 'utf8');
        this.data = JSON.parse(content);
      }
    } catch (e) {
      console.warn('MockDB: Could not load persistent data');
      this.data = {};
    }
  }

  save() {
    try {
      fs.writeFileSync(dbFile, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.warn('MockDB: Could not save data');
    }
  }

  collection(name) {
    if (!this.data[name]) this.data[name] = [];
    return new MockCollection(name, this.data[name], () => this.save());
  }

  command(cmd) {
    if (cmd.ping === 1) return Promise.resolve({ ok: 1 });
    return Promise.reject(new Error('Unknown command'));
  }

  async close() {
    this.save();
  }
}

class MockCollection {
  constructor(name, data, save) {
    this.name = name;
    this.data = data;
    this.save = save;
  }

  async insertOne(doc) {
    if (!doc.id) doc.id = require('uuid').v4();
    this.data.push(doc);
    this.save();
    return { insertedId: doc.id };
  }

  async insertMany(docs) {
    docs.forEach(doc => {
      if (!doc.id) doc.id = require('uuid').v4();
      this.data.push(doc);
    });
    this.save();
    return { insertedIds: docs.map(d => d.id) };
  }

  async findOne(query) {
    return this.data.find(doc => this.matches(doc, query)) || null;
  }

  find(query, opts = {}) {
    let results = this.data.filter(doc => this.matches(doc, query));
    
    // Apply projection if specified
    if (opts.projection) {
      results = results.map(doc => {
        const filtered = {};
        Object.keys(doc).forEach(key => {
          if (opts.projection[key] !== 0) {
            filtered[key] = doc[key];
          }
        });
        return filtered;
      });
    }
    
    return new MockCursor(results);
  }

  async countDocuments(query = {}) {
    return this.data.filter(doc => this.matches(doc, query)).length;
  }

  async updateOne(query, update) {
    const idx = this.data.findIndex(doc => this.matches(doc, query));
    if (idx === -1) return { modifiedCount: 0 };
    if (update.$set) Object.assign(this.data[idx], update.$set);
    if (update.$push) {
      Object.keys(update.$push).forEach(key => {
        if (!this.data[idx][key]) this.data[idx][key] = [];
        const val = update.$push[key];
        if (val.$each) {
          this.data[idx][key].push(...val.$each);
        } else {
          this.data[idx][key].push(val);
        }
      });
    }
    this.save();
    return { modifiedCount: 1 };
  }

  async deleteOne(query) {
    const idx = this.data.findIndex(doc => this.matches(doc, query));
    if (idx === -1) return { deletedCount: 0 };
    this.data.splice(idx, 1);
    this.save();
    return { deletedCount: 1 };
  }

  async createIndex(spec, opts = {}) {
    // Mock: just return success
    return Promise.resolve();
  }

  matches(doc, query) {
    if (!query || typeof query !== 'object') return true;
    
    for (const [key, val] of Object.entries(query)) {
      if (typeof val === 'object' && val.$gt !== undefined && doc[key] <= val.$gt) return false;
      if (typeof val === 'object' && val.$lt !== undefined && doc[key] >= val.$lt) return false;
      if (typeof val === 'object' && val.$in !== undefined && !val.$in.includes(doc[key])) return false;
      if (typeof val !== 'object' && doc[key] !== val) return false;
    }
    return true;
  }
}

class MockCursor {
  constructor(results, opts = {}) {
    this.results = results;
    this.opts = opts;
  }

  sort(spec) {
    Object.entries(spec).forEach(([key, dir]) => {
      this.results.sort((a, b) => dir === -1 ? (b[key] > a[key] ? 1 : -1) : (a[key] > b[key] ? 1 : -1));
    });
    return this;
  }

  limit(n) {
    this.results = this.results.slice(0, n);
    return this;
  }

  skip(n) {
    this.results = this.results.slice(n);
    return this;
  }

  async toArray() {
    return this.results;
  }

  [Symbol.asyncIterator]() {
    let idx = 0;
    return {
      next: async () => {
        if (idx < this.results.length) {
          return { value: this.results[idx++], done: false };
        }
        return { done: true };
      }
    };
  }
}

module.exports = { MockDB };
