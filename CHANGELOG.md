# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.1.1]

### Fixed

- Data reference not working properly

## [1.1.0]

### Added

- Support for plain JSON deserialization
- (dev) GitHub Action

### Fixed

- Export name in UMD build

### Removed

- Unused file

## [1.0.2]

### Fixed

- Fix the `package.json` export for NPM

## [1.0.1]

### Added

- Add `package.json` export

### Fixed

- Handle `undefined` (and any data that is not a string) in `deserialize`
- Handle invalid JSON in `deserialize`

## [1.0.0]

First version

[unreleased]: https://github.com/MacFJA/js-serializer/compare/1.1.1...HEAD
[1.1.1]: https://github.com/MacFJA/js-serializer/releases/tag/1.1.1
[1.1.0]: https://github.com/MacFJA/js-serializer/releases/tag/1.1.0
[1.0.2]: https://github.com/MacFJA/js-serializer/releases/tag/1.0.2
[1.0.1]: https://github.com/MacFJA/js-serializer/releases/tag/1.0.1
[1.0.0]: https://github.com/MacFJA/js-serializer/releases/tag/1.0.0
