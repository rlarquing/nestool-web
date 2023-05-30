import { DexieTable } from '../db'

export class GenericRepository<T> {
  protected table: any

  constructor (table: string, relations?: string[]) {
    this.table = new DexieTable<T>(table, relations)
  }

  async add (data: any): Promise<void> {
    await this.table.add(data)
  }

  async addAll (data: any[]): Promise<void> {
    await this.table.addMultiple(data)
  }

  async get (id: number): Promise<any> {
    return await this.table.get(id)
  }

  async getAll (): Promise<any[]> {
    return await this.table.getAll()
  }

  async delete (id: number): Promise<void> {
    await this.table.delete(id)
  };

  async deleteAll (): Promise<void> {
    const items: any[] = await this.getAll()
    for (const item of items) {
      await this.delete(item.id)
    }
  };

  async update (id: number, data: any): Promise<void> {
    await this.table.update(id, data)
  };

  async cantidad (): Promise<number> {
    return (await this.getAll()).length
  };
}
