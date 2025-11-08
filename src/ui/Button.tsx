import clsx from "clsx";

interface IProps extends React.ComponentPropsWithRef<"button"> {
  variant: "blue" | "red"
}

export function Button({ variant, children, ...rest }: IProps) {
  return (
    <button className={clsx(
      "px-4 py-2 rounded-lg text-white cursor-pointer",
      (variant === "blue" && "bg-blue-700"),
      (variant === "red" && "bg-red-700"),
    )} {...rest}>
      {children}
    </button>
  );
}