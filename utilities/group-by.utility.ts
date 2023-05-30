export const groupBy = (list: any, keyGetter: any) => {
    const map: any = new Map();
    list.forEach((item: any) => {
        const key: any = keyGetter(item);
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    });
    return map;
};
