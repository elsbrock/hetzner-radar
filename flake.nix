# flake.nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        fhs = pkgs.buildFHSUserEnv {
          name = "fhs-shell";
          targetPkgs = pkgs: [pkgs.gcc pkgs.libtool pkgs.python311];
        };
      in
        {
          devShells.${system}.default = fhs.env;
        }
    );
}