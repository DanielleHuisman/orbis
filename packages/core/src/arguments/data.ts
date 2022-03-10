// TODO: find a way to have correct where typing (typegen?)

export type Data = boolean | string | number | Date | Data[];

export type DataArgument = {
    [key: string]: Data | DataArgument | DataArgument[];
};
