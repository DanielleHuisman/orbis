// TODO: find a way to have correct where typing (typegen?)

export type DataArgument = {
    [key: string]: boolean | string | number | DataArgument | DataArgument[];
};
