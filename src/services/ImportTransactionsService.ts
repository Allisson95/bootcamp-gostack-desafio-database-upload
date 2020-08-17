import parse from 'csv-parse';
import fs from 'fs';
import path from 'path';

import { getRepository, In } from 'typeorm';
import Transaction from '../models/Transaction';

import uploadConfig from '../config/upload.config';
import Category from '../models/Category';

interface Request {
  filename: string;
}

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute({ filename }: Request): Promise<Transaction[]> {
    const csvFilePath = path.resolve(uploadConfig.directory, filename);

    const csvParseStream = parse({
      delimiter: ',',
      from_line: 2,
      ltrim: true,
      rtrim: true,
    });

    const csvReadStream = fs.createReadStream(csvFilePath);

    const parseCsv = csvReadStream.pipe(csvParseStream);

    const csvTransactions: CSVTransaction[] = [];

    parseCsv.on('data', ([title, type, value, category]) => {
      csvTransactions.push({
        title,
        type,
        value,
        category,
      });
    });

    await new Promise(resolve => parseCsv.on('end', resolve));

    const transactionsRepository = getRepository(Transaction);
    const categoriesRepository = getRepository(Category);

    const categories = csvTransactions.map(transaction => transaction.category);

    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const existentCategoriesTitle = existentCategories.map(
      category => category.title,
    );

    const addCategories = categories
      .filter(category => !existentCategoriesTitle.includes(category))
      .filter((category, index, self) => self.indexOf(category) === index)
      .map(category => ({ title: category }));

    const newCategories = categoriesRepository.create(addCategories);

    const savedCategories = await categoriesRepository.save(newCategories);

    const finalCategories = [...existentCategories, ...savedCategories];

    const addTransactions = csvTransactions.map(
      ({ title, type, value, category }) => ({
        title,
        type,
        value,
        category: finalCategories.find(
          ({ title: categoryTitle }) => categoryTitle === category,
        ),
      }),
    );

    const newTransactions = transactionsRepository.create(addTransactions);

    const savedTransactions = transactionsRepository.save(newTransactions);

    await fs.promises.unlink(csvFilePath);

    return savedTransactions;
  }
}

export default ImportTransactionsService;
