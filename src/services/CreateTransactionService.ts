import { getCustomRepository, getRepository } from 'typeorm';

import Category from '../models/Category';
import Transaction from '../models/Transaction';

import TransactionsRepository from '../repositories/TransactionsRepository';

import AppError from '../errors/AppError';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    if (!['income', 'outcome'].includes(type)) {
      throw new AppError('Invalid transaction type');
    }

    const transactionsRepository = getCustomRepository(TransactionsRepository);

    if (type === 'outcome') {
      const { total } = await transactionsRepository.getBalance();

      if (value > total) {
        throw new AppError('You do not have enough balance');
      }
    }

    const categoriesRepository = getRepository(Category);

    let savedCategory = await categoriesRepository.findOne({
      where: {
        title: category,
      },
    });

    if (!savedCategory) {
      const newCategory = categoriesRepository.create({
        title: category,
      });

      savedCategory = await categoriesRepository.save(newCategory);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: savedCategory,
    });

    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
