import bcrypt from "bcrypt";

const HASHING_ROUNDS = 10;

export const hashValue = async (
  value: string,
  rounds: number = HASHING_ROUNDS,
): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(rounds);

    const hashedValue = await bcrypt.hash(value, salt);

    return hashedValue;
  } catch (error) {
    throw error;
  }
};

export const compareValue = async (
  value: string,
  hash: string,
): Promise<boolean> => {
  try {
    const isMatch = await bcrypt.compare(value, hash);
    return isMatch;
  } catch (error) {
    throw error;
  }
};
