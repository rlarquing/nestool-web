import Dexie from 'dexie'

export class Schema {
  // eslint-disable-next-line no-useless-constructor
  constructor () {

  }
}

export class DexieTable<T> {
  tableName: string
  db: any
  tablas: any
  relations?: string[]

  constructor (tableName: string, relations?: string[]) {
    this.tablas = new Schema()
    this.tableName = tableName
    this.relations = relations
    this.db = new Dexie('nestool')
    this.db.version(1).stores(this.schema())
  }

  schema (): any {
    const result: any = {}
    for (const tabla in this.tablas) {
      result[tabla] = Object.keys(this.tablas[tabla]).join(', ')
    }
    return result
  }

  async getAll (): Promise<T[]> {
    const obj = await this.db[this.tableName].toArray()
    if (this.relations) {
      const result: any[] = []
      for (const item of obj) {
        for (const table of this.relations) {
          const data = await this.db[table].get(item[`${table}_id`])
          delete item[`${table}_id`]
          item[table] = data
        }
        result.push(item)
      }
      return result
    }
    return obj
  }

  async get (id: number): Promise<T | undefined> {
    if (this.relations) {
      const obj: any = await this.db[this.tableName].get(id)
      // eslint-disable-next-line no-unreachable-loop
      for (const table of this.relations) {
        const data = await this.db[table].get(obj[`${table}_id`])
        delete obj[`${table}_id`]
        obj[table] = data
        return obj
      }
    }
    return await this.db[this.tableName].get(id)
  }

  async add (item: any): Promise<void> {
    const id = await this.get(item.id)
    if (id === undefined) {
      try {
        await this.db[this.tableName].add(item)
      } catch (e: any) {
        console.log(e.message)
      }
    } else {
      try {
        await this.db[this.tableName].put(item)
      } catch (e: any) {
        console.log(e.message)
      }
    }
  }

  async update (id: number, changes: Partial<T>): Promise<void> {
    await this.db[this.tableName].update(id, changes)
  }

  async delete (id: number): Promise<void> {
    await this.db[this.tableName].delete(id)
  }

  async addMultiple (items: T[]): Promise<void> {
    await this.db.transaction('rw', this.db[this.tableName], async () => {
      await this.db[this.tableName].bulkPut(items)
    })
  }
}
